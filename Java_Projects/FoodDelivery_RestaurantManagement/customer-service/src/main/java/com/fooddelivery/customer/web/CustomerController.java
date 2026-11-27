package com.fooddelivery.customer.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.customer.client.OrderHistoryGateway;
import com.fooddelivery.customer.domain.Customer;
import com.fooddelivery.customer.service.CustomerService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@Tag(name = "Customers")
public class CustomerController {
    private final CustomerService service;
    private final OrderHistoryGateway orderHistory;

    public CustomerController(CustomerService service, OrderHistoryGateway orderHistory) {
        this.service = service;
        this.orderHistory = orderHistory;
    }

    @GetMapping("/api/customers/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.CustomerDto me() { return Dtos.CustomerDto.from(service.current()); }

    @PutMapping("/api/customers/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.CustomerDto update(@Valid @RequestBody Dtos.UpdateCustomerRequest r) { return service.update(r); }

    @PostMapping(value = "/api/customers/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.CustomerDto avatar(@RequestPart("file") MultipartFile file) { return service.uploadAvatar(file); }

    @GetMapping("/api/customers/me/addresses")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<Dtos.AddressDto> addresses() { return service.listAddresses(); }

    @PostMapping("/api/customers/me/addresses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.AddressDto add(@Valid @RequestBody Dtos.AddressRequest r) { return service.addAddress(r); }

    @PutMapping("/api/customers/me/addresses/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.AddressDto update(@PathVariable Long id, @Valid @RequestBody Dtos.AddressRequest r) { return service.updateAddress(id, r); }

    @PatchMapping("/api/customers/me/addresses/{id}/default")
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.AddressDto makeDefault(@PathVariable Long id) { return service.makeDefault(id); }

    @DeleteMapping("/api/customers/me/addresses/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteAddress(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/customers/me/activity")
    @PreAuthorize("hasRole('CUSTOMER')")
    public PageResponse<Dtos.ActivityDto> activity(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.activity(CustomerService.page(page, size)), a -> a);
    }

    /** Customer order-history integration: Feign call to order-service, degrades to an empty list if it is down. */
    @GetMapping("/api/customers/me/orders")
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.OrderHistory orders(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return orderHistory.history(page, size);
    }

    @GetMapping("/api/customers")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PageResponse<Dtos.CustomerDto> search(@RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.search(q, CustomerService.page(page, size)), c -> c);
    }

    @PatchMapping("/api/customers/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public Dtos.CustomerDto status(@PathVariable Long id, @Valid @RequestBody Dtos.StatusRequest r) { return service.setStatus(id, r.status()); }

    // ---- internal (not routed through the gateway) ----
    @GetMapping("/internal/customers/{userId}/addresses/{addressId}")
    public Dtos.AddressDto address(@PathVariable Long userId, @PathVariable Long addressId) { return service.addressOf(userId, addressId); }

    @GetMapping("/internal/customers/{userId}")
    @PreAuthorize("hasAnyRole('SERVICE','ADMIN','SUPER_ADMIN','CUSTOMER')")
    public Dtos.CustomerDto summary(@PathVariable Long userId) { return service.summary(userId); }
}
