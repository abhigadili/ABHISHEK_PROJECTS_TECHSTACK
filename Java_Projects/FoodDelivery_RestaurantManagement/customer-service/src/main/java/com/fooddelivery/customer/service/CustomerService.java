package com.fooddelivery.customer.service;

import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.file.FileStorageService;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.customer.domain.*;
import com.fooddelivery.customer.repository.*;
import com.fooddelivery.customer.web.Dtos;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;

@Service
public class CustomerService {
    private final CustomerRepository customers;
    private final AddressRepository addresses;
    private final CustomerActivityRepository activities;
    private final FileStorageService storage;

    public CustomerService(CustomerRepository customers, AddressRepository addresses, CustomerActivityRepository activities,
                           FileStorageService storage) {
        this.customers = customers;
        this.addresses = addresses;
        this.activities = activities;
        this.storage = storage;
    }

    /** Profile of the caller; auto-provisioned on first access if the user.registered event has not been processed yet. */
    @Transactional
    public Customer current() {
        AuthUser u = SecurityUtils.requireUser();
        Customer c = customers.findWithAddresses(u.userId()).orElseGet(() -> {
            Customer n = new Customer();
            n.setUserId(u.userId());
            n.setFullName(u.username());
            return customers.save(n);
        });
        if (c.getStatus() == Customer.Status.BLOCKED) throw new ForbiddenException("Your customer account is blocked");
        return c;
    }

    /** Idempotent upsert driven by the user.registered event. */
    @Transactional
    public void onUserRegistered(Events.UserRegistered e) {
        Customer c = customers.findById(e.userId()).orElseGet(Customer::new);
        c.setUserId(e.userId());
        c.setFullName(e.fullName());
        c.setEmail(e.email());
        c.setPhone(e.phone());
        customers.save(c);
        activities.save(new CustomerActivity(e.userId(), "REGISTERED", "Account created"));
    }

    @Transactional
    public Dtos.CustomerDto update(Dtos.UpdateCustomerRequest r) {
        Customer c = current();
        c.setFullName(r.fullName().trim());
        c.setPhone(r.phone());
        if (r.preferences() != null) {
            var p = c.getPreferences();
            p.setFavouriteCuisines(r.preferences().favouriteCuisines());
            p.setVegetarianOnly(r.preferences().vegetarianOnly());
            p.setNotifyEmail(r.preferences().notifyEmail());
            p.setNotifySms(r.preferences().notifySms());
            p.setNotifyInApp(r.preferences().notifyInApp());
        }
        c.setLastActiveAt(Instant.now());
        return Dtos.CustomerDto.from(c);
    }

    @Transactional
    public Dtos.CustomerDto uploadAvatar(MultipartFile file) {
        Customer c = current();
        String old = c.getAvatarUrl();
        c.setAvatarUrl(storage.store(file, "customers"));
        storage.delete(old);
        return Dtos.CustomerDto.from(c);
    }

    // ---------------- addresses ----------------
    @Transactional(readOnly = true)
    public List<Dtos.AddressDto> listAddresses() {
        return customers.findWithAddresses(SecurityUtils.requireUser().userId()).map(Customer::getAddresses).orElse(List.of())
                .stream().map(Dtos.AddressDto::from).toList();
    }

    @Transactional
    public Dtos.AddressDto addAddress(Dtos.AddressRequest r) {
        Customer c = current();
        Address a = new Address();
        apply(a, r);
        boolean first = c.getAddresses().isEmpty();
        a.setDefaultAddress(first || r.makeDefault());
        if (a.isDefaultAddress()) c.getAddresses().forEach(x -> x.setDefaultAddress(false));
        c.addAddress(a);
        customers.flush();
        return Dtos.AddressDto.from(a);
    }

    @Transactional
    public Dtos.AddressDto updateAddress(Long id, Dtos.AddressRequest r) {
        Customer c = current();
        Address a = c.getAddresses().stream().filter(x -> x.getId().equals(id)).findFirst().orElseThrow(() -> new NotFoundException("Address", id));
        apply(a, r);
        if (r.makeDefault()) setDefault(c, a);
        return Dtos.AddressDto.from(a);
    }

    @Transactional
    public Dtos.AddressDto makeDefault(Long id) {
        Customer c = current();
        Address a = c.getAddresses().stream().filter(x -> x.getId().equals(id)).findFirst().orElseThrow(() -> new NotFoundException("Address", id));
        setDefault(c, a);
        return Dtos.AddressDto.from(a);
    }

    @Transactional
    public void deleteAddress(Long id) {
        Customer c = current();
        Address a = c.getAddresses().stream().filter(x -> x.getId().equals(id)).findFirst().orElseThrow(() -> new NotFoundException("Address", id));
        if (c.getAddresses().size() == 1) throw new ConflictException("You must keep at least one address");
        c.getAddresses().remove(a);     // orphanRemoval deletes the row
        if (a.isDefaultAddress()) c.getAddresses().get(0).setDefaultAddress(true);
    }

    private void setDefault(Customer c, Address target) {
        c.getAddresses().forEach(x -> x.setDefaultAddress(x == target));
    }

    private void apply(Address a, Dtos.AddressRequest r) {
        a.setLabel(r.label());
        a.setLine1(r.line1());
        a.setLine2(r.line2());
        a.setCity(r.city());
        a.setState(r.state());
        a.setPostalCode(r.postalCode());
        a.setLatitude(r.latitude());
        a.setLongitude(r.longitude());
    }

    /** Used by order-service (internal API): the address must belong to the customer (ownership check). */
    @Transactional(readOnly = true)
    public Dtos.AddressDto addressOf(Long userId, Long addressId) {
        AuthUser caller = SecurityUtils.requireUser();
        if (!caller.isService() && !caller.isAdmin() && caller.userId() != userId) throw new ForbiddenException("Not your address");
        Address a = addresses.findByIdAndCustomerUserId(addressId, userId).orElseThrow(() -> new NotFoundException("Address", addressId));
        return Dtos.AddressDto.from(a);
    }

    // ---------------- activity & admin ----------------
    @Transactional(readOnly = true)
    public Page<Dtos.ActivityDto> activity(Pageable p) {
        return activities.findByCustomerIdOrderByCreatedAtDesc(SecurityUtils.requireUser().userId(), p).map(Dtos.ActivityDto::from);
    }

    @Transactional
    public void recordActivity(Long customerId, String type, String detail) {
        activities.save(new CustomerActivity(customerId, type, detail));
        customers.findById(customerId).ifPresent(c -> c.setLastActiveAt(Instant.now()));
    }

    @Transactional(readOnly = true)
    public Page<Dtos.CustomerDto> search(String q, Pageable pageable) {
        Page<Customer> page = (q == null || q.isBlank()) ? customers.findAll(pageable) : customers.search(q.trim(), pageable);
        return page.map(Dtos.CustomerDto::from);
    }

    @Transactional
    public Dtos.CustomerDto setStatus(Long id, Customer.Status status) {
        Customer c = customers.findById(id).orElseThrow(() -> new NotFoundException("Customer", id));
        c.setStatus(status);
        return Dtos.CustomerDto.from(c);
    }

    @Transactional(readOnly = true)
    public Dtos.CustomerDto summary(Long userId) {
        return customers.findById(userId).map(Dtos.CustomerDto::from).orElseThrow(() -> new NotFoundException("Customer", userId));
    }

    public static Pageable page(int page, int size) { return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)); }
}
