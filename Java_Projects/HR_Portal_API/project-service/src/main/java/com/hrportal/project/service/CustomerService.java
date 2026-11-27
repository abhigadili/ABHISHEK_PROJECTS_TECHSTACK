package com.hrportal.project.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.persistence.CrudService;
import com.hrportal.project.dto.ProjectDtos.ContactRequest;
import com.hrportal.project.dto.ProjectDtos.ContactResponse;
import com.hrportal.project.dto.ProjectDtos.CustomerRequest;
import com.hrportal.project.dto.ProjectDtos.CustomerResponse;
import com.hrportal.project.entity.Customer;
import com.hrportal.project.entity.CustomerContact;
import com.hrportal.project.entity.Enums.ProjectStatus;
import com.hrportal.project.repository.ProjectRepositories.ContactRepository;
import com.hrportal.project.repository.ProjectRepositories.CustomerRepository;
import com.hrportal.project.repository.ProjectRepositories.ProjectRepository;

/** Customer management plus customer contacts. */
@Service
public class CustomerService extends CrudService<Customer, CustomerRequest, CustomerResponse> {
    private final CustomerRepository customers;
    private final ContactRepository contacts;
    private final ProjectRepository projects;

    public CustomerService(CustomerRepository customers, ContactRepository contacts, ProjectRepository projects, AuditService audit) {
        super(customers, audit, Customer.class, CustomerResponse.class);
        this.customers = customers;
        this.contacts = contacts;
        this.projects = projects;
    }

    @Transactional(readOnly = true)
    public Page<CustomerResponse> search(String q, Pageable pageable) {
        String like = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase().replace("%", "") + "%";
        return customers.search(like, pageable).map(this::toResponse);
    }

    @Override
    protected void beforeCreate(Customer c, CustomerRequest r) {
        if (customers.existsByCodeIgnoreCase(r.code())) throw new ConflictException("Customer code already exists: " + r.code());
        c.setCode(r.code().toUpperCase());
    }

    @Override
    protected void beforeDelete(Customer c) {
        if (projects.existsByCustomerIdAndStatusIn(c.getId(), List.of(ProjectStatus.PLANNED, ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD))) {
            throw new BadRequestException("Customer still has open projects");
        }
    }

    // ---- contacts
    @Transactional(readOnly = true)
    public List<ContactResponse> contacts(String customerId) {
        find(customerId);
        return BeanMapper.toRecords(contacts.findByCustomerIdOrderByNameAsc(customerId), ContactResponse.class);
    }

    @Transactional
    public ContactResponse addContact(String customerId, ContactRequest req) {
        find(customerId);
        CustomerContact c = BeanMapper.toEntity(req, CustomerContact.class);
        c.setCustomerId(customerId);
        if (c.isPrimaryContact()) clearPrimary(customerId, null);
        c = contacts.save(c);
        audit.record("CustomerContact", c.getId(), "CREATED", customerId, BeanMapper.toRecord(c, ContactResponse.class));
        return BeanMapper.toRecord(c, ContactResponse.class);
    }

    @Transactional
    public ContactResponse updateContact(String customerId, String contactId, ContactRequest req) {
        CustomerContact c = contacts.findById(contactId).filter(x -> x.getCustomerId().equals(customerId))
                .orElseThrow(() -> com.hrportal.common.exception.ResourceNotFoundException.of("Contact", contactId));
        BeanMapper.copyNonNull(req, c);
        if (c.isPrimaryContact()) clearPrimary(customerId, contactId);
        return BeanMapper.toRecord(contacts.save(c), ContactResponse.class);
    }

    @Transactional
    public void deleteContact(String customerId, String contactId) {
        CustomerContact c = contacts.findById(contactId).filter(x -> x.getCustomerId().equals(customerId))
                .orElseThrow(() -> com.hrportal.common.exception.ResourceNotFoundException.of("Contact", contactId));
        c.markDeleted();
        contacts.save(c);
    }

    private void clearPrimary(String customerId, String exceptId) {
        contacts.findByCustomerIdOrderByNameAsc(customerId).stream().filter(x -> x.isPrimaryContact() && !x.getId().equals(exceptId)).forEach(x -> {
            x.setPrimaryContact(false);
            contacts.save(x);
        });
    }
}
