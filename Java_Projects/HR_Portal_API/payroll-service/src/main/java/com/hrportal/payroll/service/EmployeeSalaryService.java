package com.hrportal.payroll.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.payroll.dto.PayrollDtos.AssignSalaryRequest;
import com.hrportal.payroll.dto.PayrollDtos.RevisionRequest;
import com.hrportal.payroll.dto.PayrollDtos.RevisionResponse;
import com.hrportal.payroll.dto.PayrollDtos.SalaryHistoryResponse;
import com.hrportal.payroll.dto.PayrollDtos.SalaryResponse;
import com.hrportal.payroll.dto.PayrollDtos.SalarySummary;
import com.hrportal.payroll.entity.EmployeeSalary;
import com.hrportal.payroll.entity.Enums.RevisionStatus;
import com.hrportal.payroll.entity.Enums.SalaryStatus;
import com.hrportal.payroll.entity.PayrollEntry;
import com.hrportal.payroll.entity.SalaryComponent;
import com.hrportal.payroll.entity.SalaryRevision;
import com.hrportal.payroll.entity.SalaryStructure;
import com.hrportal.payroll.entity.SalaryStructureComponent;
import com.hrportal.payroll.repository.PayrollRepositories.ComponentRepository;
import com.hrportal.payroll.repository.PayrollRepositories.EmployeeSalaryRepository;
import com.hrportal.payroll.repository.PayrollRepositories.EntryRepository;
import com.hrportal.payroll.repository.PayrollRepositories.RevisionHistoryRepository;
import com.hrportal.payroll.repository.PayrollRepositories.RevisionRepository;
import com.hrportal.payroll.repository.PayrollRepositories.StructureComponentRepository;
import com.hrportal.payroll.repository.PayrollRepositories.StructureRepository;

/** Salary assignment, revisions (payroll proposes, finance approves) and the salary summary. Salary data is visible only to the employee, payroll, finance and super admins. */
@Service
@Transactional
public class EmployeeSalaryService {
    private final EmployeeSalaryRepository salaries;
    private final StructureRepository structures;
    private final StructureComponentRepository structureLines;
    private final ComponentRepository components;
    private final RevisionRepository revisions;
    private final RevisionHistoryRepository history;
    private final EntryRepository entries;
    private final AuditService audit;

    public EmployeeSalaryService(EmployeeSalaryRepository salaries, StructureRepository structures, StructureComponentRepository structureLines,
                                 ComponentRepository components, RevisionRepository revisions, RevisionHistoryRepository history, EntryRepository entries,
                                 AuditService audit) {
        this.salaries = salaries;
        this.structures = structures;
        this.structureLines = structureLines;
        this.components = components;
        this.revisions = revisions;
        this.history = history;
        this.entries = entries;
        this.audit = audit;
    }

    public SalaryResponse assign(String employeeId, AssignSalaryRequest req) {
        if (salaries.findFirstByEmployeeIdAndStatusOrderByEffectiveFromDesc(employeeId, SalaryStatus.ACTIVE).isPresent()) {
            throw new ConflictException("The employee already has an active salary - propose a revision instead");
        }
        SalaryStructure structure = structures.findById(req.structureId()).filter(SalaryStructure::isActive).orElseThrow(() -> new BadRequestException("Unknown or inactive structure"));
        EmployeeSalary s = new EmployeeSalary();
        s.setEmployeeId(employeeId);
        s.setStructureId(structure.getId());
        s.setAnnualCtc(req.annualCtc());
        s.setEffectiveFrom(req.effectiveFrom());
        if (req.currency() != null) s.setCurrency(req.currency());
        s = salaries.save(s);
        audit.record("EmployeeSalary", s.getId(), "ASSIGNED", employeeId, structure.getName() + " CTC=" + req.annualCtc());
        return toResponse(s, structure.getName());
    }

    @Transactional(readOnly = true)
    public SalaryResponse current(String employeeId) {
        requireAccess(employeeId);
        EmployeeSalary s = salaries.findFirstByEmployeeIdAndStatusOrderByEffectiveFromDesc(employeeId, SalaryStatus.ACTIVE)
                .orElseThrow(() -> ResourceNotFoundException.of("Salary of employee", employeeId));
        return toResponse(s, structures.findById(s.getStructureId()).map(SalaryStructure::getName).orElse(null));
    }

    @Transactional(readOnly = true)
    public List<SalaryHistoryResponse> history(String employeeId) {
        requireAccess(employeeId);
        return BeanMapper.toRecords(history.findByEmployeeIdOrderByChangedAtDesc(employeeId), SalaryHistoryResponse.class);
    }

    // ------------------------------------------------------------------ revisions (maker-checker)
    public RevisionResponse propose(String employeeId, RevisionRequest req) {
        EmployeeSalary current = salaries.findFirstByEmployeeIdAndStatusOrderByEffectiveFromDesc(employeeId, SalaryStatus.ACTIVE)
                .orElseThrow(() -> new BadRequestException("The employee has no active salary to revise"));
        if (revisions.existsByEmployeeIdAndStatus(employeeId, RevisionStatus.PENDING)) throw new ConflictException("A revision is already waiting for approval");
        if (req.effectiveFrom().isBefore(current.getEffectiveFrom().plusDays(1))) throw new BadRequestException("Effective date must be after the current salary's start date");
        if (req.newStructureId() != null && !structures.existsById(req.newStructureId())) throw new BadRequestException("Unknown structure");
        SalaryRevision r = new SalaryRevision();
        r.setEmployeeId(employeeId);
        r.setOldCtc(current.getAnnualCtc());
        r.setNewCtc(req.newCtc());
        r.setNewStructureId(req.newStructureId());
        r.setEffectiveFrom(req.effectiveFrom());
        r.setReason(req.reason());
        r = revisions.save(r);
        audit.record("SalaryRevision", r.getId(), "PROPOSED", employeeId, r.getOldCtc() + " -> " + r.getNewCtc());
        return BeanMapper.toRecord(r, RevisionResponse.class);
    }

    public RevisionResponse approve(String revisionId, String comment) {
        SalaryRevision r = pendingRevision(revisionId);
        EmployeeSalary current = salaries.findFirstByEmployeeIdAndStatusOrderByEffectiveFromDesc(r.getEmployeeId(), SalaryStatus.ACTIVE)
                .orElseThrow(() -> new BadRequestException("The employee has no active salary"));
        current.setStatus(SalaryStatus.SUPERSEDED);                 // UPDATE trigger writes the history row
        current.setEffectiveTo(r.getEffectiveFrom().minusDays(1));
        salaries.saveAndFlush(current);
        EmployeeSalary next = new EmployeeSalary();                 // INSERT trigger writes the history row
        next.setEmployeeId(r.getEmployeeId());
        next.setStructureId(r.getNewStructureId() != null ? r.getNewStructureId() : current.getStructureId());
        next.setAnnualCtc(r.getNewCtc());
        next.setCurrency(current.getCurrency());
        next.setEffectiveFrom(r.getEffectiveFrom());
        salaries.save(next);
        r.setStatus(RevisionStatus.APPROVED);
        decide(r, comment);
        audit.record("SalaryRevision", revisionId, "APPROVED", r.getEmployeeId(), comment);
        return BeanMapper.toRecord(r, RevisionResponse.class);
    }

    public RevisionResponse reject(String revisionId, String comment) {
        SalaryRevision r = pendingRevision(revisionId);
        r.setStatus(RevisionStatus.REJECTED);
        decide(r, comment);
        audit.record("SalaryRevision", revisionId, "REJECTED", r.getEmployeeId(), comment);
        return BeanMapper.toRecord(r, RevisionResponse.class);
    }

    @Transactional(readOnly = true)
    public List<RevisionResponse> revisions(String status) {
        List<SalaryRevision> list = status == null ? revisions.findAll() : revisions.findByStatusOrderByCreatedAtAsc(RevisionStatus.valueOf(status));
        return BeanMapper.toRecords(list, RevisionResponse.class);
    }

    private SalaryRevision pendingRevision(String id) {
        SalaryRevision r = revisions.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Salary revision", id));
        if (r.getStatus() != RevisionStatus.PENDING) throw new BadRequestException("Revision is already " + r.getStatus());
        if (r.getCreatedBy() != null && r.getCreatedBy().equals(CurrentUser.auditName())) throw new ForbiddenOperationException("The person who proposed a revision cannot approve it (maker-checker)");
        return r;
    }

    private void decide(SalaryRevision r, String comment) {
        r.setDecidedBy(CurrentUser.auditName());
        r.setDecidedAt(java.time.Instant.now());
        r.setDecisionComment(comment);
        revisions.save(r);
    }

    // ------------------------------------------------------------------ summary
    /** Current salary + year-to-date figures of the FINALIZED runs of the financial year (April - March). Used by Tax and Exit. */
    @Transactional(readOnly = true)
    public SalarySummary summary(String employeeId) {
        requireAccess(employeeId);
        EmployeeSalary s = salaries.findFirstByEmployeeIdAndStatusOrderByEffectiveFromDesc(employeeId, SalaryStatus.ACTIVE)
                .orElseThrow(() -> ResourceNotFoundException.of("Salary of employee", employeeId));
        SalaryStructure st = structures.findById(s.getStructureId()).orElse(null);
        BigDecimal monthly = s.getAnnualCtc().divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
        BigDecimal basicPercent = basicPercent(s.getStructureId());
        BigDecimal monthlyBasic = monthly.multiply(basicPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        YearMonth now = YearMonth.now();
        int startYear = now.getMonthValue() >= 4 ? now.getYear() : now.getYear() - 1;
        List<PayrollEntry> ytd = entries.findFinalizedForEmployee(employeeId, YearMonth.of(startYear, 4).toString(), YearMonth.of(startYear + 1, 3).toString());
        PayrollEntry latest = ytd.isEmpty() ? null : ytd.get(ytd.size() - 1);
        return new SalarySummary(employeeId, st == null ? null : st.getName(), s.getAnnualCtc(), monthly, monthlyBasic, latest == null ? null : latest.getPayrollMonth(),
                latest == null ? null : latest.getGross(), latest == null ? null : latest.getNet(), sum(ytd, PayrollEntry::getGross), sum(ytd, PayrollEntry::getDeductions),
                sum(ytd, PayrollEntry::getNet), ytd.size());
    }

    private BigDecimal basicPercent(String structureId) {
        Optional<SalaryComponent> basic = components.findByCodeIgnoreCase("BASIC");
        if (basic.isEmpty()) return BigDecimal.ZERO;
        return structureLines.findByStructureId(structureId).stream().filter(l -> l.getComponentId().equals(basic.get().getId())).map(SalaryStructureComponent::getValue)
                .findFirst().filter(v -> basic.get().getCalcType() == com.hrportal.payroll.entity.Enums.CalcType.PERCENT_OF_CTC).orElse(BigDecimal.ZERO);
    }

    private static BigDecimal sum(List<PayrollEntry> list, Function<PayrollEntry, BigDecimal> f) {
        return list.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void requireAccess(String employeeId) {
        if (CurrentUser.hasAnyRole(Role.PAYROLL_ADMIN, Role.FINANCE_ADMIN, Role.SUPER_ADMIN)) return;
        if (employeeId.equals(CurrentUser.employeeId())) return;
        throw new ForbiddenOperationException("Salary information is restricted to the employee, payroll and finance");
    }

    private SalaryResponse toResponse(EmployeeSalary s, String structureName) {
        return new SalaryResponse(s.getId(), s.getEmployeeId(), s.getStructureId(), structureName, s.getAnnualCtc(),
                s.getAnnualCtc().divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP), s.getCurrency(), s.getEffectiveFrom(), s.getEffectiveTo(), s.getStatus().name());
    }
}
