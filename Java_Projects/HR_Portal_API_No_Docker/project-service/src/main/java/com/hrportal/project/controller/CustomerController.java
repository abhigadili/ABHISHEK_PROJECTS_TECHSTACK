package com.hrportal.project.controller;

import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.project.dto.ProjectDtos.ContactRequest;
import com.hrportal.project.dto.ProjectDtos.ContactResponse;
import com.hrportal.project.dto.ProjectDtos.CustomerRequest;
import com.hrportal.project.dto.ProjectDtos.CustomerResponse;
import com.hrportal.project.service.CustomerService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Customers")
@RestController
@RequestMapping("/api/v1/customers")
public class CustomerController {
    private static final Set<String> SORT = Set.of("code", "name", "industry", "createdAt");
    private final CustomerService service;

    public CustomerController(CustomerService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN')")
    public PageResponse<CustomerResponse> list(@RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "name,asc") String sort) {
        return PageResponse.of(service.search(q, PageRequests.of(page, size, sort, SORT, "name")));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN')")
    public CustomerResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerResponse create(@Valid @RequestBody CustomerRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    public CustomerResponse update(@PathVariable String id, @Valid @RequestBody CustomerRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    @GetMapping("/{id}/contacts")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER','HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN')")
    public List<ContactResponse> contacts(@PathVariable String id) {
        return service.contacts(id);
    }

    @PostMapping("/{id}/contacts")
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ContactResponse addContact(@PathVariable String id, @Valid @RequestBody ContactRequest req) {
        return service.addContact(id, req);
    }

    @PutMapping("/{id}/contacts/{contactId}")
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    public ContactResponse updateContact(@PathVariable String id, @PathVariable String contactId, @Valid @RequestBody ContactRequest req) {
        return service.updateContact(id, contactId, req);
    }

    @DeleteMapping("/{id}/contacts/{contactId}")
    @PreAuthorize("hasAuthority('PERM_PROJECT_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteContact(@PathVariable String id, @PathVariable String contactId) {
        service.deleteContact(id, contactId);
    }
}
