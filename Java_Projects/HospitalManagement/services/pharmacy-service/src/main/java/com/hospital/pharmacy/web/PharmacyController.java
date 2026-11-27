package com.hospital.pharmacy.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.common.web.PageResponse;
import com.hospital.pharmacy.domain.OrderStatus;
import com.hospital.pharmacy.dto.PharmacyDtos.*;
import com.hospital.pharmacy.service.PharmacyService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/pharmacy")
public class PharmacyController {
    private final PharmacyService service;

    public PharmacyController(PharmacyService service) {
        this.service = service;
    }

    @GetMapping("/medicines")
    public List<MedicineResponse> medicines() {
        return service.listMedicines();
    }

    @PostMapping("/medicines")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST')")
    @ResponseStatus(HttpStatus.CREATED)
    public MedicineResponse add(@Valid @RequestBody MedicineRequest r) {
        return service.addMedicine(r);
    }

    @PutMapping("/medicines/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST')")
    public MedicineResponse update(@PathVariable Long id, @Valid @RequestBody MedicineRequest r) {
        return service.updateMedicine(id, r);
    }

    @PostMapping("/medicines/{id}/restock")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST')")
    public MedicineResponse restock(@PathVariable Long id, @Valid @RequestBody RestockRequest r) {
        return service.restock(id, r.getQuantity());
    }

    @GetMapping("/orders")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST')")
    public PageResponse<OrderResponse> orders(@RequestParam(required = false) OrderStatus status,
                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.orders(status, page, size));
    }

    @GetMapping("/orders/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST')")
    public OrderResponse order(@PathVariable Long id) {
        return service.order(id);
    }

    @GetMapping("/orders/prescription/{prescriptionId}")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST','DOCTOR')")
    public OrderResponse byPrescription(@PathVariable Long prescriptionId) {
        return service.orderByPrescription(prescriptionId);
    }

    @PostMapping("/orders/{id}/dispense")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST')")
    public OrderResponse dispense(@PathVariable Long id) {
        return service.dispense(id);
    }

    @PostMapping("/orders/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN','PHARMACIST')")
    public OrderResponse reject(@PathVariable Long id, @Valid @RequestBody RejectRequest r) {
        return service.reject(id, r.getReason());
    }
}
