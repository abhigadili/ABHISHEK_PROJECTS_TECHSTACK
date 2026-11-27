package com.fooddelivery.order.service;

import com.fooddelivery.order.exception.ResourceNotFoundException;
import com.fooddelivery.order.model.CustomerAddress;
import com.fooddelivery.order.repository.CustomerAddressRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class CustomerAddressService {

    private final CustomerAddressRepository customerAddressRepository;

    public CustomerAddressService(CustomerAddressRepository customerAddressRepository) {
        this.customerAddressRepository = customerAddressRepository;
    }

    public Flux<CustomerAddress> findAll(Long customerId) {
        return customerId != null
                ? customerAddressRepository.findByCustomerId(customerId)
                : customerAddressRepository.findAll();
    }

    public Mono<CustomerAddress> findById(Long id) {
        return customerAddressRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Customer address not found: " + id)));
    }

    public Mono<CustomerAddress> create(CustomerAddress address) {
        CustomerAddress toSave = new CustomerAddress(null, address.customerId(), address.addressLine1(),
                address.addressLine2(), address.city(), address.state(), address.postalCode(),
                address.country(), address.latitude(), address.longitude(), address.isDefault());
        return customerAddressRepository.save(toSave);
    }

    public Mono<CustomerAddress> update(Long id, CustomerAddress address) {
        return findById(id)
                .map(existing -> new CustomerAddress(id, address.customerId(), address.addressLine1(),
                        address.addressLine2(), address.city(), address.state(), address.postalCode(),
                        address.country(), address.latitude(), address.longitude(), address.isDefault()))
                .flatMap(customerAddressRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(customerAddressRepository::delete);
    }
}
