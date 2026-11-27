package com.hrportal.leave.controller;

import java.time.YearMonth;
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

import com.hrportal.leave.dto.LeaveDtos.LeaveTypeRequest;
import com.hrportal.leave.dto.LeaveDtos.LeaveTypeResponse;
import com.hrportal.leave.dto.LeaveDtos.PolicyRequest;
import com.hrportal.leave.dto.LeaveDtos.PolicyResponse;
import com.hrportal.leave.dto.LeaveDtos.RunResult;
import com.hrportal.leave.service.LeaveBalanceService;
import com.hrportal.leave.service.LeaveCatalogService.LeavePolicyService;
import com.hrportal.leave.service.LeaveCatalogService.LeaveTypeService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Leave Administration")
@RestController
@RequestMapping("/api/v1/leaves")
public class LeaveAdminController {
    private final LeaveTypeService types;
    private final LeavePolicyService policies;
    private final LeaveBalanceService balances;

    public LeaveAdminController(LeaveTypeService types, LeavePolicyService policies, LeaveBalanceService balances) {
        this.types = types;
        this.policies = policies;
        this.balances = balances;
    }

    @GetMapping("/types")
    public List<LeaveTypeResponse> types() {
        return types.activeTypes();
    }

    @PostMapping("/types")
    @PreAuthorize("hasAuthority('PERM_LEAVE_POLICY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public LeaveTypeResponse createType(@Valid @RequestBody LeaveTypeRequest req) {
        return types.create(req);
    }

    @PutMapping("/types/{id}")
    @PreAuthorize("hasAuthority('PERM_LEAVE_POLICY_MANAGE')")
    public LeaveTypeResponse updateType(@PathVariable String id, @Valid @RequestBody LeaveTypeRequest req) {
        return types.update(id, req);
    }

    @DeleteMapping("/types/{id}")
    @PreAuthorize("hasAuthority('PERM_LEAVE_POLICY_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteType(@PathVariable String id) {
        types.delete(id);
    }

    @GetMapping("/policies")
    public List<PolicyResponse> policies() {
        return policies.list();
    }

    @GetMapping("/policies/{id}")
    public PolicyResponse policy(@PathVariable String id) {
        return policies.get(id);
    }

    @PostMapping("/policies")
    @PreAuthorize("hasAuthority('PERM_LEAVE_POLICY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public PolicyResponse createPolicy(@Valid @RequestBody PolicyRequest req) {
        return policies.create(req);
    }

    @PutMapping("/policies/{id}")
    @PreAuthorize("hasAuthority('PERM_LEAVE_POLICY_MANAGE')")
    public PolicyResponse updatePolicy(@PathVariable String id, @Valid @RequestBody PolicyRequest req) {
        return policies.update(id, req);
    }

    @PostMapping("/accrual/run")
    @PreAuthorize("hasAuthority('PERM_LEAVE_POLICY_MANAGE')")
    public RunResult accrue(@RequestParam(required = false) String month) {
        return balances.accrueMonth(month == null ? YearMonth.now() : YearMonth.parse(month));
    }

    @PostMapping("/carry-forward/run")
    @PreAuthorize("hasAuthority('PERM_LEAVE_POLICY_MANAGE')")
    public RunResult carryForward(@RequestParam int fromYear) {
        return balances.carryForward(fromYear);
    }
}
