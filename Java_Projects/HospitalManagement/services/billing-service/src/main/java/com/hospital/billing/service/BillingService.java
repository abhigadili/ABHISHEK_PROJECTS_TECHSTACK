package com.hospital.billing.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.billing.client.AppointmentGateway;
import com.hospital.billing.domain.*;
import com.hospital.billing.dto.BillingDtos.*;
import com.hospital.common.client.PatientGateway;
import com.hospital.common.client.PatientSummary;
import com.hospital.common.events.*;
import com.hospital.common.kafka.EventPublisher;
import com.hospital.common.security.CurrentUser;
import com.hospital.common.security.Role;
import com.hospital.common.web.BadRequestException;
import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ResourceNotFoundException;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class BillingService {
    private final BillRepository bills;
    private final PaymentRepository payments;
    private final PatientGateway patients;            // OpenFeign
    private final AppointmentGateway appointments;    // WebClient
    private final PaymentGatewaySimulator simulator;
    private final EventPublisher events;
    private final int dueDays;

    public BillingService(BillRepository bills, PaymentRepository payments, PatientGateway patients, AppointmentGateway appointments,
                          PaymentGatewaySimulator simulator, EventPublisher events, @Value("${hospital.billing.due-days:7}") int dueDays) {
        this.bills = bills;
        this.payments = payments;
        this.patients = patients;
        this.appointments = appointments;
        this.simulator = simulator;
        this.events = events;
        this.dueDays = dueDays;
    }

    // ---- bill generation ------------------------------------------------------------------------------------

    /** Manual bill raised by billing staff; an APPOINTMENT bill is verified against the Appointment Service (WebClient). */
    @Transactional
    public BillResponse createManual(BillRequest r) {
        PatientSummary patient = patients.summary(r.getPatientId());
        String refType = null;
        if (r.getBillType() != BillType.OTHER && r.getReferenceId() != null) refType = r.getBillType().name();
        if (r.getBillType() == BillType.APPOINTMENT) {
            if (r.getReferenceId() == null) throw new BadRequestException("referenceId (appointment id) is required for APPOINTMENT bills");
            var appt = appointments.appointment(r.getReferenceId());
            if (!patient.getId().equals(appt.getPatientId())) throw new BadRequestException("Appointment " + appt.getId() + " does not belong to patient " + patient.getId());
            if ("CANCELLED".equals(appt.getStatus())) throw new BadRequestException("Appointment " + appt.getId() + " is cancelled");
        }
        if (refType != null && bills.existsByReferenceTypeAndReferenceId(refType, r.getReferenceId())) {
            throw new ConflictException("A " + refType + " bill already exists for reference " + r.getReferenceId());
        }
        Bill b = newBill(patient.getId(), patient.getFullName(), patient.getEmail(), r.getBillType(), refType, refType == null ? null : r.getReferenceId(), r.getNote());
        r.getItems().forEach(i -> b.addItem(BillItem.of(i.getDescription(), i.getQuantity(), i.getUnitPrice())));
        return BillResponse.from(persistAndAnnounce(b));
    }

    /** Called from Kafka consumers; (referenceType, referenceId) uniqueness guarantees one bill per business object. */
    @Transactional
    public void generateFromEvent(BillType type, String referenceType, Long referenceId, Long patientId, String patientName, String patientEmail,
                                  String description, BigDecimal unitPrice, int quantity) {
        if (unitPrice == null || unitPrice.signum() <= 0) {
            log.info("No billable amount for {} #{} - bill not created", referenceType, referenceId);
            return;
        }
        if (bills.existsByReferenceTypeAndReferenceId(referenceType, referenceId)) {
            log.info("Bill for {} #{} already exists - skipping", referenceType, referenceId);
            return;
        }
        Bill b = newBill(patientId, patientName, patientEmail, type, referenceType, referenceId, "Auto-generated from " + referenceType + " #" + referenceId);
        b.addItem(BillItem.of(description, quantity, unitPrice));
        persistAndAnnounce(b);
    }

    /** Medicines: one line per dispensed item. */
    @Transactional
    public void generateMedicineBill(MedicineDispensedEvent e) {
        if (bills.existsByReferenceTypeAndReferenceId("PHARMACY_ORDER", e.orderId())) return;
        if (e.totalAmount() == null || e.totalAmount().signum() <= 0) return;
        Bill b = newBill(e.patientId(), e.patientName(), e.patientEmail(), BillType.MEDICINE, "PHARMACY_ORDER", e.orderId(), "Medicines dispensed for prescription #" + e.prescriptionId());
        e.items().forEach(i -> b.addItem(BillItem.of(i.medicineName(), i.quantity(), i.unitPrice())));
        persistAndAnnounce(b);
    }

    /** Compensating action: an unpaid appointment bill is cancelled when its appointment is cancelled. */
    @Transactional
    public void onAppointmentCancelled(Long appointmentId) {
        bills.findByReferenceTypeAndReferenceId("APPOINTMENT", appointmentId).ifPresent(b -> {
            if (b.getStatus() == BillStatus.PENDING || b.getStatus() == BillStatus.OVERDUE) {
                b.setStatus(BillStatus.CANCELLED);
                b.setNote("Cancelled because appointment " + appointmentId + " was cancelled");
                log.info("Bill {} cancelled (appointment {} cancelled)", b.getBillNumber(), appointmentId);
            } else if (b.getStatus() == BillStatus.PAID) {
                b.setNote("Appointment " + appointmentId + " was cancelled after payment - REFUND REQUIRED");
                log.warn("Bill {} is already PAID but appointment {} was cancelled: manual refund required", b.getBillNumber(), appointmentId);
            }
        });
    }

    private Bill newBill(Long patientId, String patientName, String email, BillType type, String refType, Long refId, String note) {
        Bill b = new Bill();
        b.setBillNumber("TMP-" + UUID.randomUUID());
        b.setPatientId(patientId);
        b.setPatientName(patientName);
        b.setPatientEmail(email);
        b.setBillType(type);
        b.setReferenceType(refType);
        b.setReferenceId(refId);
        b.setNote(note);
        b.setDueDate(LocalDate.now().plusDays(dueDays));
        return b;
    }

    private Bill persistAndAnnounce(Bill b) {
        b = bills.saveAndFlush(b);
        b.setBillNumber(String.format("BILL-%s-%06d", LocalDate.now().toString().replace("-", ""), b.getId()));
        final Bill saved = bills.saveAndFlush(b);
        events.publish(Topics.BILLING_GENERATED, String.valueOf(saved.getId()), new BillingGeneratedEvent(EventPublisher.newId(), EventPublisher.now(),
                saved.getId(), saved.getBillNumber(), saved.getPatientId(), saved.getPatientName(), saved.getPatientEmail(), saved.getBillType().name(),
                saved.getReferenceType(), saved.getReferenceId(), saved.getTotalAmount(), saved.getDueDate()));
        log.info("Bill {} generated: {} {} for patient {}", saved.getBillNumber(), saved.getTotalAmount(), saved.getCurrency(), saved.getPatientId());
        return saved;
    }

    // ---- payments (Scenario 6) ------------------------------------------------------------------------------

    @Transactional
    public PaymentResponse initiatePayment(Long billId, PaymentRequest r) {
        Bill b = findBill(billId);
        guard(b);
        if (b.getStatus() == BillStatus.PAID) throw new ConflictException("Bill " + b.getBillNumber() + " is already paid");
        if (b.getStatus() == BillStatus.CANCELLED) throw new ConflictException("Bill " + b.getBillNumber() + " is cancelled");
        if (payments.existsByBillIdAndStatus(billId, PaymentStatus.PENDING)) throw new ConflictException("A payment for this bill is already in progress");
        Payment p = new Payment();
        p.setBill(b);
        p.setMethod(r.getMethod());
        p.setAmount(b.outstanding());
        p.setTransactionRef("TXN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase());
        p = payments.saveAndFlush(p);
        log.info("Payment {} initiated for bill {} amount {} via {}", p.getTransactionRef(), b.getBillNumber(), p.getAmount(), p.getMethod());
        switch (simulator.authorise(r.getMethod(), r.getSimulateOutcome())) {
            case SUCCESS -> settle(p, PaymentStatus.SUCCESS, null);
            case FAILURE -> settle(p, PaymentStatus.FAILED, "Declined by simulated gateway");
            case UNDECIDED -> { /* stays PENDING until confirmed through the status endpoint (gateway callback) */ }
        }
        return PaymentResponse.from(p);
    }

    @Transactional
    public PaymentResponse updatePaymentStatus(String transactionRef, PaymentStatusUpdate u) {
        Payment p = payments.findByTransactionRef(transactionRef).orElseThrow(() -> new ResourceNotFoundException("Payment " + transactionRef + " not found"));
        if (p.getStatus() != PaymentStatus.PENDING) throw new ConflictException("Payment " + transactionRef + " is already " + p.getStatus());
        if (u.getStatus() == PaymentStatus.PENDING) throw new BadRequestException("status must be SUCCESS or FAILED");
        settle(p, u.getStatus(), u.getFailureReason());
        return PaymentResponse.from(p);
    }

    /** Settles a PENDING payment, updates the bill and publishes PaymentCompleted / PaymentFailed. */
    @Transactional
    public void settle(Payment p, PaymentStatus outcome, String reason) {
        Bill b = p.getBill();
        p.setStatus(outcome);
        p.setCompletedAt(Instant.now());
        if (outcome == PaymentStatus.SUCCESS) {
            b.setPaidAmount(b.getPaidAmount().add(p.getAmount()));
            if (b.outstanding().signum() <= 0) b.setStatus(BillStatus.PAID);
            events.publish(Topics.PAYMENT_COMPLETED, String.valueOf(b.getId()), new PaymentCompletedEvent(EventPublisher.newId(), EventPublisher.now(),
                    b.getId(), b.getBillNumber(), p.getTransactionRef(), b.getPatientId(), b.getPatientName(), b.getPatientEmail(), b.getReferenceType(), b.getReferenceId(), p.getAmount()));
        } else {
            p.setFailureReason(reason == null ? "Payment failed" : reason);
            events.publish(Topics.PAYMENT_FAILED, String.valueOf(b.getId()), new PaymentFailedEvent(EventPublisher.newId(), EventPublisher.now(),
                    b.getId(), b.getBillNumber(), p.getTransactionRef(), b.getPatientId(), b.getPatientName(), b.getPatientEmail(), b.getReferenceType(), b.getReferenceId(), p.getAmount(), p.getFailureReason()));
        }
        payments.save(p);
        log.info("Payment {} -> {} (bill {} now {})", p.getTransactionRef(), outcome, b.getBillNumber(), b.getStatus());
    }

    @Transactional
    public BillResponse cancel(Long billId) {
        Bill b = findBill(billId);
        if (b.getStatus() == BillStatus.PAID) throw new ConflictException("A paid bill cannot be cancelled");
        if (payments.existsByBillIdAndStatus(billId, PaymentStatus.PENDING)) throw new ConflictException("A payment is in progress for this bill");
        b.setStatus(BillStatus.CANCELLED);
        return BillResponse.from(b);
    }

    // ---- reads -----------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public BillResponse get(Long id) {
        Bill b = findBill(id);
        guard(b);
        return BillResponse.from(b);
    }

    @Transactional(readOnly = true)
    public List<BillResponse> forPatient(Long patientId) {
        patients.requireAccess(patientId);
        return bills.findByPatient(patientId).stream().map(BillResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Page<BillResponse> list(BillStatus status, int page, int size) {
        PageRequest pr = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt"));
        return (status == null ? bills.findAll(pr) : bills.findByStatus(status, pr)).map(b -> {
            b.getItems().size();
            return BillResponse.from(b);
        });
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> paymentsOf(Long billId) {
        guard(findBill(billId));
        return payments.findByBillIdOrderByInitiatedAtDesc(billId).stream().map(PaymentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PaymentResponse payment(String ref) {
        Payment p = payments.findByTransactionRef(ref).orElseThrow(() -> new ResourceNotFoundException("Payment " + ref + " not found"));
        guard(p.getBill());
        return PaymentResponse.from(p);
    }

    private void guard(Bill b) {
        if (CurrentUser.hasRole(Role.PATIENT) && !CurrentUser.isAdmin()) patients.requireAccess(b.getPatientId());
    }

    private Bill findBill(Long id) {
        return bills.findWithItems(id).orElseThrow(() -> new ResourceNotFoundException("Bill " + id + " not found"));
    }
}
