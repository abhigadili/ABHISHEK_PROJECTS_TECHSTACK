package com.hrportal.payroll.service;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.payroll.dto.PayrollDtos.AdjustmentRequest;
import com.hrportal.payroll.dto.PayrollDtos.AdjustmentResponse;
import com.hrportal.payroll.dto.PayrollDtos.LoanRequest;
import com.hrportal.payroll.dto.PayrollDtos.LoanResponse;
import com.hrportal.payroll.entity.Adjustment;
import com.hrportal.payroll.entity.Enums.AdjustmentStatus;
import com.hrportal.payroll.entity.Enums.AdjustmentType;
import com.hrportal.payroll.entity.Enums.LoanStatus;
import com.hrportal.payroll.entity.Enums.RunStatus;
import com.hrportal.payroll.entity.Loan;
import com.hrportal.payroll.repository.PayrollRepositories.AdjustmentRepository;
import com.hrportal.payroll.repository.PayrollRepositories.LoanRepository;
import com.hrportal.payroll.repository.PayrollRepositories.RunRepository;

/** One-off payroll adjustments (bonus, arrears, reimbursements, other deductions) and employee loans / advances. */
@Service
@Transactional
public class AdjustmentLoanService {
    private final AdjustmentRepository adjustments;
    private final LoanRepository loans;
    private final RunRepository runs;
    private final AuditService audit;

    public AdjustmentLoanService(AdjustmentRepository adjustments, LoanRepository loans, RunRepository runs, AuditService audit) {
        this.adjustments = adjustments;
        this.loans = loans;
        this.runs = runs;
        this.audit = audit;
    }

    public AdjustmentResponse addAdjustment(AdjustmentRequest req) {
        requireOpenMonth(req.month());
        Adjustment a = BeanMapper.toEntity(req, Adjustment.class);
        a.setPayrollMonth(req.month());
        a = adjustments.save(a);
        audit.record("PayrollAdjustment", a.getId(), "CREATED", req.employeeId() + " " + req.type() + " " + req.amount());
        return BeanMapper.toRecord(a, AdjustmentResponse.class);
    }

    public void cancelAdjustment(String id) {
        Adjustment a = adjustments.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Adjustment", id));
        if (a.getStatus() != AdjustmentStatus.PENDING) throw new BadRequestException("Only a PENDING adjustment can be cancelled");
        a.setStatus(AdjustmentStatus.CANCELLED);
        adjustments.save(a);
        audit.record("PayrollAdjustment", id, "CANCELLED", a.getEmployeeId());
    }

    @Transactional(readOnly = true)
    public Page<AdjustmentResponse> adjustments(String month, String employeeId, Pageable pageable) {
        if (employeeId != null) {
            if (!CurrentUser.hasAnyRole(Role.PAYROLL_ADMIN, Role.FINANCE_ADMIN, Role.SUPER_ADMIN) && !employeeId.equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Not allowed");
            return adjustments.findByEmployeeId(employeeId, pageable).map(a -> BeanMapper.toRecord(a, AdjustmentResponse.class));
        }
        if (month == null) throw new BadRequestException("Provide month or employeeId");
        return adjustments.findByPayrollMonth(month, pageable).map(a -> BeanMapper.toRecord(a, AdjustmentResponse.class));
    }

    /** Called when the exit workflow completes the full & final settlement: becomes a payroll adjustment of the current month. */
    public void addFinalSettlement(String employeeId, String resignationId, BigDecimal netPayable) {
        if (adjustments.findAll().stream().anyMatch(a -> resignationId.equals(a.getReferenceId()) && a.getType() == AdjustmentType.FINAL_SETTLEMENT)) return;   // idempotent
        Adjustment a = new Adjustment();
        a.setEmployeeId(employeeId);
        a.setPayrollMonth(YearMonth.now().toString());
        a.setType(AdjustmentType.FINAL_SETTLEMENT);
        a.setAmount(netPayable.abs());
        a.setDescription((netPayable.signum() >= 0 ? "Full and final settlement payable" : "Full and final settlement recoverable") + " (resignation " + resignationId + ")");
        a.setReferenceId(resignationId);
        a.setStatus(AdjustmentStatus.APPLIED);       // recorded for the audit trail; paid through the settlement process, not the monthly run
        adjustments.save(a);
        audit.record("PayrollAdjustment", a.getId(), "FINAL_SETTLEMENT", employeeId + " " + netPayable);
    }

    // ---- loans
    public LoanResponse addLoan(LoanRequest req) {
        if (req.emi().compareTo(req.principal()) > 0) throw new BadRequestException("EMI cannot exceed the principal");
        Loan l = BeanMapper.toEntity(req, Loan.class);
        l.setOutstanding(req.principal());
        l = loans.save(l);
        audit.record("Loan", l.getId(), "CREATED", req.employeeId() + " " + req.principal());
        return BeanMapper.toRecord(l, LoanResponse.class);
    }

    public LoanResponse closeLoan(String id) {
        Loan l = loans.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Loan", id));
        l.setStatus(LoanStatus.CLOSED);
        l.setOutstanding(BigDecimal.ZERO);
        audit.record("Loan", id, "CLOSED", l.getEmployeeId());
        return BeanMapper.toRecord(loans.save(l), LoanResponse.class);
    }

    @Transactional(readOnly = true)
    public List<LoanResponse> loansOf(String employeeId) {
        if (!CurrentUser.hasAnyRole(Role.PAYROLL_ADMIN, Role.FINANCE_ADMIN, Role.SUPER_ADMIN) && !employeeId.equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Not allowed");
        return BeanMapper.toRecords(loans.findByEmployeeIdOrderByCreatedAtDesc(employeeId), LoanResponse.class);
    }

    private void requireOpenMonth(String month) {
        runs.findByPayrollMonth(month).ifPresent(r -> {
            if (r.getStatus() != RunStatus.DRAFT) throw new BadRequestException("The payroll run of " + month + " is already " + r.getStatus() + " - use the next month");
        });
    }
}
