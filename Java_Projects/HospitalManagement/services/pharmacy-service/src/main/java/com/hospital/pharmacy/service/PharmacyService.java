package com.hospital.pharmacy.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.events.MedicineDispensedEvent;
import com.hospital.common.events.PrescriptionCreatedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.EventPublisher;
import com.hospital.common.security.CurrentUser;
import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.pharmacy.client.PrescriptionGateway;
import com.hospital.pharmacy.domain.*;
import com.hospital.pharmacy.dto.PharmacyDtos.*;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class PharmacyService {
    private final MedicineRepository medicines;
    private final PharmacyOrderRepository orders;
    private final PrescriptionGateway prescriptions;   // OpenFeign + circuit breaker
    private final EventPublisher events;

    public PharmacyService(MedicineRepository medicines, PharmacyOrderRepository orders, PrescriptionGateway prescriptions, EventPublisher events) {
        this.medicines = medicines;
        this.orders = orders;
        this.prescriptions = prescriptions;
        this.events = events;
    }

    // ---- inventory ---------------------------------------------------------------------------------------

    @Transactional
    public MedicineResponse addMedicine(MedicineRequest r) {
        if (medicines.existsBySku(r.getSku())) throw new ConflictException("SKU '" + r.getSku() + "' already exists");
        Medicine m = new Medicine();
        apply(m, r);
        return MedicineResponse.from(medicines.save(m));
    }

    @Transactional
    public MedicineResponse updateMedicine(Long id, MedicineRequest r) {
        Medicine m = findMedicine(id);
        if (!m.getSku().equals(r.getSku()) && medicines.existsBySku(r.getSku())) throw new ConflictException("SKU '" + r.getSku() + "' already exists");
        apply(m, r);
        return MedicineResponse.from(m);
    }

    @Transactional
    public MedicineResponse restock(Long id, int qty) {
        Medicine m = medicines.lockById(id).orElseThrow(() -> new ResourceNotFoundException("Medicine " + id + " not found"));
        m.setStockQuantity(m.getStockQuantity() + qty);
        if (m.getStockQuantity() > m.getReorderLevel()) m.setLastLowStockAlertAt(null);
        return MedicineResponse.from(m);
    }

    @Transactional(readOnly = true)
    public List<MedicineResponse> listMedicines() {
        return medicines.findByActiveTrueOrderByName().stream().map(MedicineResponse::from).toList();
    }

    // ---- prescription events -> orders --------------------------------------------------------------------

    /** Consumer of PrescriptionCreated: opens a PENDING pharmacy order, pre-matching each line to inventory. */
    @Transactional
    public void openOrder(PrescriptionCreatedEvent e) {
        if (orders.existsByPrescriptionId(e.prescriptionId())) {
            log.info("Pharmacy order for prescription {} already exists", e.prescriptionId());
            return;
        }
        PharmacyOrder o = new PharmacyOrder();
        o.setPrescriptionId(e.prescriptionId());
        o.setPatientId(e.patientId());
        o.setPatientName(e.patientName());
        o.setPatientEmail(e.patientEmail());
        o.setDoctorName(e.doctorName());
        for (PrescriptionCreatedEvent.Item i : e.items()) {
            PharmacyOrderItem item = new PharmacyOrderItem();
            item.setMedicineName(i.medicineName());
            item.setDosage(i.dosage());
            item.setQuantity(i.quantity());
            medicines.findMatches(i.medicineName()).stream().findFirst().ifPresent(m -> {
                item.setMedicine(m);
                item.setUnitPrice(m.getUnitPrice());
            });
            o.addItem(item);
        }
        orders.save(o);
        log.info("Pharmacy order {} opened for prescription {} ({} lines)", o.getId(), e.prescriptionId(), o.getItems().size());
    }

    // ---- dispensing ----------------------------------------------------------------------------------------

    @Transactional
    public OrderResponse dispense(Long orderId) {
        PharmacyOrder o = findOrder(orderId);
        if (o.getStatus() != OrderStatus.PENDING) throw new ConflictException("Order " + orderId + " is already " + o.getStatus());
        String rxStatus = prescriptions.status(o.getPrescriptionId()).getStatus();     // Feign call
        if (!"ACTIVE".equals(rxStatus)) throw new ConflictException("Prescription " + o.getPrescriptionId() + " is " + rxStatus + " and cannot be dispensed");

        // lock the stock rows in id order (avoids deadlocks) and verify everything BEFORE changing anything
        List<String> problems = new ArrayList<>();
        for (PharmacyOrderItem i : o.getItems()) {
            if (i.getMedicine() == null) {
                medicines.findMatches(i.getMedicineName()).stream().findFirst().ifPresent(m -> {
                    i.setMedicine(m);
                    i.setUnitPrice(m.getUnitPrice());
                });
            }
            if (i.getMedicine() == null) {
                problems.add(i.getMedicineName() + ": not in inventory");
                continue;
            }
            Medicine m = medicines.lockById(i.getMedicine().getId()).orElseThrow();
            if (m.getStockQuantity() < i.getQuantity()) problems.add(i.getMedicineName() + ": need " + i.getQuantity() + ", only " + m.getStockQuantity() + " in stock");
        }
        if (!problems.isEmpty()) throw new ConflictException("Cannot dispense - " + String.join("; ", problems));

        BigDecimal total = BigDecimal.ZERO;
        List<MedicineDispensedEvent.Item> sold = new ArrayList<>();
        for (PharmacyOrderItem i : o.getItems()) {
            Medicine m = medicines.lockById(i.getMedicine().getId()).orElseThrow();
            m.setStockQuantity(m.getStockQuantity() - i.getQuantity());
            i.setUnitPrice(m.getUnitPrice());
            total = total.add(m.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())));
            sold.add(new MedicineDispensedEvent.Item(i.getMedicineName(), i.getQuantity(), m.getUnitPrice()));
        }
        o.setStatus(OrderStatus.DISPENSED);
        o.setTotalAmount(total);
        o.setDispensedBy(CurrentUser.username());
        o.setDispensedAt(Instant.now());
        events.publish(Topics.MEDICINE_DISPENSED, String.valueOf(o.getId()), new MedicineDispensedEvent(EventPublisher.newId(), EventPublisher.now(),
                o.getId(), o.getPrescriptionId(), o.getPatientId(), o.getPatientName(), o.getPatientEmail(), total, sold));
        log.info("Order {} dispensed by {} total {}", o.getId(), o.getDispensedBy(), total);
        return OrderResponse.from(o);
    }

    @Transactional
    public OrderResponse reject(Long orderId, String reason) {
        PharmacyOrder o = findOrder(orderId);
        if (o.getStatus() != OrderStatus.PENDING) throw new ConflictException("Order " + orderId + " is already " + o.getStatus());
        o.setStatus(OrderStatus.REJECTED);
        o.setRejectionReason(reason);
        return OrderResponse.from(o);
    }

    @Transactional(readOnly = true)
    public OrderResponse order(Long id) {
        return OrderResponse.from(findOrder(id));
    }

    @Transactional(readOnly = true)
    public OrderResponse orderByPrescription(Long prescriptionId) {
        return OrderResponse.from(orders.findByPrescription(prescriptionId).orElseThrow(() -> new ResourceNotFoundException("No pharmacy order for prescription " + prescriptionId)));
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> orders(OrderStatus status, int page, int size) {
        PageRequest pr = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt"));
        return (status == null ? orders.findAll(pr) : orders.findByStatus(status, pr)).map(o -> {
            o.getItems().forEach(i -> { if (i.getMedicine() != null) i.getMedicine().getStockQuantity(); });
            return OrderResponse.from(o);
        });
    }

    private PharmacyOrder findOrder(Long id) {
        return orders.findWithItems(id).orElseThrow(() -> new ResourceNotFoundException("Pharmacy order " + id + " not found"));
    }

    private Medicine findMedicine(Long id) {
        return medicines.findById(id).orElseThrow(() -> new ResourceNotFoundException("Medicine " + id + " not found"));
    }

    private static void apply(Medicine m, MedicineRequest r) {
        m.setSku(r.getSku().trim());
        m.setName(r.getName().trim());
        m.setGenericName(r.getGenericName());
        m.setUnitPrice(r.getUnitPrice());
        m.setStockQuantity(r.getStockQuantity());
        if (r.getReorderLevel() != null) m.setReorderLevel(r.getReorderLevel());
    }
}
