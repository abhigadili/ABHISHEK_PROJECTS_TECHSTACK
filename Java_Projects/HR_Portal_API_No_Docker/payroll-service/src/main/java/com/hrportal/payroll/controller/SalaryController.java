package com.hrportal.payroll.controller;

import java.util.List;

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

import com.hrportal.payroll.dto.PayrollDtos.AssignSalaryRequest;
import com.hrportal.payroll.dto.PayrollDtos.ComponentRequest;
import com.hrportal.payroll.dto.PayrollDtos.ComponentResponse;
import com.hrportal.payroll.dto.PayrollDtos.ConfigResponse;
import com.hrportal.payroll.dto.PayrollDtos.ConfigUpdate;
import com.hrportal.payroll.dto.PayrollDtos.DecisionRequest;
import com.hrportal.payroll.dto.PayrollDtos.RevisionRequest;
import com.hrportal.payroll.dto.PayrollDtos.RevisionResponse;
import com.hrportal.payroll.dto.PayrollDtos.SalaryHistoryResponse;
import com.hrportal.payroll.dto.PayrollDtos.SalaryResponse;
import com.hrportal.payroll.dto.PayrollDtos.SalarySummary;
import com.hrportal.payroll.dto.PayrollDtos.StructureRequest;
import com.hrportal.payroll.dto.PayrollDtos.StructureResponse;
import com.hrportal.payroll.service.EmployeeSalaryService;
import com.hrportal.payroll.service.PayrollConfigService;
import com.hrportal.payroll.service.SalaryCatalogService.ComponentService;
import com.hrportal.payroll.service.SalaryCatalogService.StructureService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Salary Setup")
@RestController
@RequestMapping("/api/v1/payroll")
public class SalaryController {
    private final ComponentService componentService;
    private final StructureService structureService;
    private final EmployeeSalaryService salaryService;
    private final PayrollConfigService configService;

    public SalaryController(ComponentService componentService, StructureService structureService, EmployeeSalaryService salaryService, PayrollConfigService configService) {
        this.componentService = componentService;
        this.structureService = structureService;
        this.salaryService = salaryService;
        this.configService = configService;
    }

    // ---- components
    @GetMapping("/components")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','FINANCE_ADMIN','SUPER_ADMIN')")
    public List<ComponentResponse> components() {
        return componentService.all();
    }

    @PostMapping("/components")
    @PreAuthorize("hasAuthority('PERM_SALARY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ComponentResponse createComponent(@Valid @RequestBody ComponentRequest req) {
        return componentService.create(req);
    }

    @PutMapping("/components/{id}")
    @PreAuthorize("hasAuthority('PERM_SALARY_MANAGE')")
    public ComponentResponse updateComponent(@PathVariable String id, @Valid @RequestBody ComponentRequest req) {
        return componentService.update(id, req);
    }

    // ---- structures
    @GetMapping("/structures")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','FINANCE_ADMIN','SUPER_ADMIN')")
    public List<StructureResponse> structures() {
        return structureService.list();
    }

    @GetMapping("/structures/{id}")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','FINANCE_ADMIN','SUPER_ADMIN')")
    public StructureResponse structure(@PathVariable String id) {
        return structureService.get(id);
    }

    @PostMapping("/structures")
    @PreAuthorize("hasAuthority('PERM_SALARY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public StructureResponse createStructure(@Valid @RequestBody StructureRequest req) {
        return structureService.create(req);
    }

    @PutMapping("/structures/{id}")
    @PreAuthorize("hasAuthority('PERM_SALARY_MANAGE')")
    public StructureResponse updateStructure(@PathVariable String id, @Valid @RequestBody StructureRequest req) {
        return structureService.update(id, req);
    }

    @DeleteMapping("/structures/{id}")
    @PreAuthorize("hasAuthority('PERM_SALARY_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStructure(@PathVariable String id) {
        structureService.delete(id);
    }

    // ---- employee salary
    @Operation(summary = "Assign the first salary of an employee")
    @PostMapping("/employees/{employeeId}/salary")
    @PreAuthorize("hasAuthority('PERM_SALARY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public SalaryResponse assign(@PathVariable String employeeId, @Valid @RequestBody AssignSalaryRequest req) {
        return salaryService.assign(employeeId, req);
    }

    @Operation(summary = "Current salary: the employee, payroll, finance and super admin only")
    @GetMapping("/employees/{employeeId}/salary")
    public SalaryResponse salary(@PathVariable String employeeId) {
        return salaryService.current(employeeId);
    }

    @Operation(summary = "Salary revision history (written by MySQL triggers)")
    @GetMapping("/employees/{employeeId}/salary/history")
    public List<SalaryHistoryResponse> salaryHistory(@PathVariable String employeeId) {
        return salaryService.history(employeeId);
    }

    @Operation(summary = "Employee salary summary: current CTC and financial-year-to-date payroll figures (used by Tax and Exit)")
    @GetMapping("/employees/{employeeId}/salary-summary")
    public SalarySummary summary(@PathVariable String employeeId) {
        return salaryService.summary(employeeId);
    }

    // ---- revisions
    @PostMapping("/employees/{employeeId}/revisions")
    @PreAuthorize("hasAuthority('PERM_SALARY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public RevisionResponse propose(@PathVariable String employeeId, @Valid @RequestBody RevisionRequest req) {
        return salaryService.propose(employeeId, req);
    }

    @GetMapping("/revisions")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','FINANCE_ADMIN','SUPER_ADMIN')")
    public List<RevisionResponse> revisions(@RequestParam(required = false) String status) {
        return salaryService.revisions(status);
    }

    @PostMapping("/revisions/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_APPROVE')")
    public RevisionResponse approveRevision(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return salaryService.approve(id, req == null ? null : req.comment());
    }

    @PostMapping("/revisions/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_PAYROLL_APPROVE')")
    public RevisionResponse rejectRevision(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return salaryService.reject(id, req == null ? null : req.comment());
    }

    // ---- configuration
    @Operation(summary = "Payroll / statutory configuration (sample values - verify before production use)")
    @GetMapping("/config")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','FINANCE_ADMIN','SUPER_ADMIN')")
    public List<ConfigResponse> config() {
        return configService.all();
    }

    @PutMapping("/config/{key}")
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
    public ConfigResponse updateConfig(@PathVariable String key, @Valid @RequestBody ConfigUpdate req) {
        return configService.update(key, req);
    }
}
