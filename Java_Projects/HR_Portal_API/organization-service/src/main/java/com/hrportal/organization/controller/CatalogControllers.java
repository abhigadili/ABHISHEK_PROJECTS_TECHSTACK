package com.hrportal.organization.controller;

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
import com.hrportal.organization.dto.OrgDtos.*;
import com.hrportal.organization.service.CatalogServices.*;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** Master-data endpoints: reads for any authenticated user, writes for HR / super admin only. */
public final class CatalogControllers {
    private CatalogControllers() {
    }

    @Tag(name = "Organizations")
    @RestController
    @RequestMapping("/api/v1/organization/organizations")
    public static class OrganizationController {
        private static final Set<String> SORT = Set.of("createdAt", "updatedAt", "name");
        private final OrganizationService service;

        public OrganizationController(OrganizationService service) {
            this.service = service;
        }

        @GetMapping
        public PageResponse<OrganizationResponse> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                         @RequestParam(required = false) String sort) {
            return PageResponse.of(service.page(PageRequests.of(page, size, sort, SORT, "name")));
        }

        @GetMapping("/{id}")
        public OrganizationResponse get(@PathVariable String id) {
            return service.get(id);
        }

        @PostMapping
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.CREATED)
        public OrganizationResponse create(@Valid @RequestBody OrganizationRequest body) {
            return service.create(body);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        public OrganizationResponse update(@PathVariable String id, @Valid @RequestBody OrganizationRequest body) {
            return service.update(id, body);
        }

        @DeleteMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void delete(@PathVariable String id) {
            service.delete(id);
        }
    }

    @Tag(name = "Business Units")
    @RestController
    @RequestMapping("/api/v1/organization/business-units")
    public static class BusinessUnitController {
        private static final Set<String> SORT = Set.of("code", "name", "createdAt");
        private final BusinessUnitService service;

        public BusinessUnitController(BusinessUnitService service) {
            this.service = service;
        }

        @GetMapping
        public PageResponse<BusinessUnitResponse> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                         @RequestParam(required = false) String sort) {
            return PageResponse.of(service.page(PageRequests.of(page, size, sort, SORT, "code")));
        }

        @GetMapping("/{id}")
        public BusinessUnitResponse get(@PathVariable String id) {
            return service.get(id);
        }

        @PostMapping
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.CREATED)
        public BusinessUnitResponse create(@Valid @RequestBody BusinessUnitRequest body) {
            return service.create(body);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        public BusinessUnitResponse update(@PathVariable String id, @Valid @RequestBody BusinessUnitRequest body) {
            return service.update(id, body);
        }

        @DeleteMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void delete(@PathVariable String id) {
            service.delete(id);
        }
    }

    @Tag(name = "Departments")
    @RestController
    @RequestMapping("/api/v1/organization/departments")
    public static class DepartmentController {
        private static final Set<String> SORT = Set.of("code", "name", "createdAt");
        private final DepartmentService service;

        public DepartmentController(DepartmentService service) {
            this.service = service;
        }

        @GetMapping
        public PageResponse<DepartmentResponse> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                         @RequestParam(required = false) String sort) {
            return PageResponse.of(service.page(PageRequests.of(page, size, sort, SORT, "code")));
        }

        @GetMapping("/{id}")
        public DepartmentResponse get(@PathVariable String id) {
            return service.get(id);
        }

        @PostMapping
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.CREATED)
        public DepartmentResponse create(@Valid @RequestBody DepartmentRequest body) {
            return service.create(body);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        public DepartmentResponse update(@PathVariable String id, @Valid @RequestBody DepartmentRequest body) {
            return service.update(id, body);
        }

        @DeleteMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void delete(@PathVariable String id) {
            service.delete(id);
        }
    }

    @Tag(name = "Job Grades")
    @RestController
    @RequestMapping("/api/v1/organization/job-grades")
    public static class JobGradeController {
        private static final Set<String> SORT = Set.of("code", "name", "level", "createdAt");
        private final JobGradeService service;

        public JobGradeController(JobGradeService service) {
            this.service = service;
        }

        @GetMapping
        public PageResponse<JobGradeResponse> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                         @RequestParam(required = false) String sort) {
            return PageResponse.of(service.page(PageRequests.of(page, size, sort, SORT, "level")));
        }

        @GetMapping("/{id}")
        public JobGradeResponse get(@PathVariable String id) {
            return service.get(id);
        }

        @PostMapping
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.CREATED)
        public JobGradeResponse create(@Valid @RequestBody JobGradeRequest body) {
            return service.create(body);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        public JobGradeResponse update(@PathVariable String id, @Valid @RequestBody JobGradeRequest body) {
            return service.update(id, body);
        }

        @DeleteMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void delete(@PathVariable String id) {
            service.delete(id);
        }
    }

    @Tag(name = "Designations")
    @RestController
    @RequestMapping("/api/v1/organization/designations")
    public static class DesignationController {
        private static final Set<String> SORT = Set.of("code", "title", "createdAt");
        private final DesignationService service;

        public DesignationController(DesignationService service) {
            this.service = service;
        }

        @GetMapping
        public PageResponse<DesignationResponse> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                         @RequestParam(required = false) String sort) {
            return PageResponse.of(service.page(PageRequests.of(page, size, sort, SORT, "title")));
        }

        @GetMapping("/{id}")
        public DesignationResponse get(@PathVariable String id) {
            return service.get(id);
        }

        @PostMapping
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.CREATED)
        public DesignationResponse create(@Valid @RequestBody DesignationRequest body) {
            return service.create(body);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        public DesignationResponse update(@PathVariable String id, @Valid @RequestBody DesignationRequest body) {
            return service.update(id, body);
        }

        @DeleteMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void delete(@PathVariable String id) {
            service.delete(id);
        }
    }

    @Tag(name = "Locations")
    @RestController
    @RequestMapping("/api/v1/organization/locations")
    public static class LocationController {
        private static final Set<String> SORT = Set.of("code", "name", "city", "createdAt");
        private final LocationService service;

        public LocationController(LocationService service) {
            this.service = service;
        }

        @GetMapping
        public PageResponse<LocationResponse> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                         @RequestParam(required = false) String sort) {
            return PageResponse.of(service.page(PageRequests.of(page, size, sort, SORT, "name")));
        }

        @GetMapping("/{id}")
        public LocationResponse get(@PathVariable String id) {
            return service.get(id);
        }

        @PostMapping
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.CREATED)
        public LocationResponse create(@Valid @RequestBody LocationRequest body) {
            return service.create(body);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        public LocationResponse update(@PathVariable String id, @Valid @RequestBody LocationRequest body) {
            return service.update(id, body);
        }

        @DeleteMapping("/{id}")
        @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void delete(@PathVariable String id) {
            service.delete(id);
        }
    }
}
