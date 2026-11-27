package com.fooddelivery.order.controller;

import com.fooddelivery.order.model.CustomerAddress;
import com.fooddelivery.order.service.CustomerAddressService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/customer-addresses")
public class CustomerAddressController {

    private final CustomerAddressService customerAddressService;

    public CustomerAddressController(CustomerAddressService customerAddressService) {
        this.customerAddressService = customerAddressService;
    }

    @GetMapping
    public Flux<CustomerAddress> findAll(@RequestParam(required = false) Long customerId) {
        return customerAddressService.findAll(customerId);
    }

    @GetMapping("/{id}")
    public Mono<CustomerAddress> findById(@PathVariable Long id) {
        return customerAddressService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CustomerAddress> create(@Valid @RequestBody CustomerAddress address) {
        return customerAddressService.create(address);
    }

    @PutMapping("/{id}")
    public Mono<CustomerAddress> update(@PathVariable Long id, @Valid @RequestBody CustomerAddress address) {
        return customerAddressService.update(id, address);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return customerAddressService.delete(id);
    }
}
