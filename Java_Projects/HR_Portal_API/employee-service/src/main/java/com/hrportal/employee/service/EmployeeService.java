package com.hrportal.employee.service;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.CacheEvictor;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.employee.client.OrganizationClient;
import com.hrportal.employee.client.OrganizationClient.OrgRef;
import com.hrportal.employee.dto.EmployeeDtos.ContactDto;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeRequest;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeResponse;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeSearchCriteria;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeSummary;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeUpdateRequest;
import com.hrportal.employee.dto.EmployeeDtos.ManagerChangeRequest;
import com.hrportal.employee.dto.EmployeeDtos.SelfContactUpdate;
import com.hrportal.employee.dto.EmployeeDtos.StatusChangeRequest;
import com.hrportal.employee.dto.EmployeeDtos.TeamMember;
import com.hrportal.employee.dto.EmployeeDtos.TransferRequest;
import com.hrportal.employee.entity.ContactInfo;
import com.hrportal.employee.entity.Employee;
import com.hrportal.employee.entity.Enums.ChangeType;
import com.hrportal.employee.entity.Enums.EmployeeStatus;
import com.hrportal.employee.entity.EmploymentHistory;
import com.hrportal.employee.entity.ProfileChangeLog;
import com.hrportal.employee.producer.EmployeeEventProducer;
import com.hrportal.employee.repository.ChildRepositories.EmploymentHistoryRepository;
import com.hrportal.employee.repository.ChildRepositories.ProfileChangeLogRepository;
import com.hrportal.employee.repository.EmployeeRepository;
import com.hrportal.employee.repository.EmployeeSpecifications;
import com.hrportal.employee.util.FieldDiff;
import com.hrportal.employee.util.FieldDiff.Change;

import feign.FeignException;

/** Employee lifecycle: onboarding, profile maintenance, status / manager / department changes, search. */
@Service
public class EmployeeService {
    private static final Logger log = LoggerFactory.getLogger(EmployeeService.class);

    private final EmployeeRepository employees;
    private final EmploymentHistoryRepository history;
    private final ProfileChangeLogRepository changeLog;
    private final EmployeeCodeGenerator codes;
    private final OrganizationClient organization;
    private final EmployeeEventProducer producer;
    private final AuditService audit;
    private final CacheEvictor cache;
    private final EmployeeAccess access;

    public EmployeeService(EmployeeRepository employees, EmploymentHistoryRepository history, ProfileChangeLogRepository changeLog,
                           EmployeeCodeGenerator codes, OrganizationClient organization, EmployeeEventProducer producer,
                           AuditService audit, CacheEvictor cache, EmployeeAccess access) {
        this.employees = employees;
        this.history = history;
        this.changeLog = changeLog;
        this.codes = codes;
        this.organization = organization;
        this.producer = producer;
        this.audit = audit;
        this.cache = cache;
        this.access = access;
    }

    // ------------------------------------------------------------------ onboarding

    @Transactional
    public EmployeeResponse onboard(EmployeeRequest req) {
        if (employees.existsByWorkEmailIgnoreCase(req.workEmail())) throw new ConflictException("Work e-mail already in use: " + req.workEmail());
        validateOrganization(req.departmentId(), req.designationId(), req.locationId(), req.jobGradeId());
        if (req.managerId() != null) requireActiveManager(req.managerId());
        Employee e = BeanMapper.toEntity(req, Employee.class);
        e.setEmployeeCode(codes.next());
        e.setStatus(EmployeeStatus.ACTIVE);
        e = employees.save(e);
        record(e.getId(), ChangeType.JOINED, null, e.getDesignationId(), e.getJoiningDate(), "Onboarded");
        producer.created(e);
        EmployeeResponse r = toResponse(e);
        audit.record("Employee", e.getId(), "ONBOARDED", null, r);
        evictAll(e.getId());
        log.info("Onboarded employee {} ({})", e.getEmployeeCode(), e.getId());
        return r;
    }

    // ------------------------------------------------------------------ reads

    /** Redis-cached profile (10 min). Access control is enforced by the controller (@PostAuthorize) on every call, cached or not. */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "employeeProfile", key = "#id")
    public EmployeeResponse getProfile(String id) {
        return toResponse(find(id));
    }

    @Transactional(readOnly = true)
    public EmployeeSummary summary(String id) {
        return BeanMapper.toRecord(find(id), EmployeeSummary.class);
    }

    @Transactional(readOnly = true)
    public List<EmployeeSummary> lookup(List<String> ids) {
        return BeanMapper.toRecords(employees.findByIdIn(new HashSet<>(ids)), EmployeeSummary.class);
    }

    @Transactional(readOnly = true)
    public Page<EmployeeResponse> search(EmployeeSearchCriteria criteria, Pageable pageable) {
        EmployeeSearchCriteria effective = criteria;
        // a plain manager only ever sees their own team
        if (CurrentUser.hasRole(Role.MANAGER) && !CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN, Role.PAYROLL_ADMIN, Role.FINANCE_ADMIN, Role.PROJECT_MANAGER)) {
            effective = new EmployeeSearchCriteria(criteria.q(), criteria.status(), criteria.employmentType(), criteria.departmentId(),
                    criteria.designationId(), criteria.locationId(), CurrentUser.employeeId(), criteria.joinedFrom(), criteria.joinedTo());
        }
        return employees.findAll(EmployeeSpecifications.from(effective), pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<TeamMember> team(String managerId) {
        access.requireSelfOrHr(managerId);
        return employees.findTeam(managerId, EmployeeStatus.TERMINATED).stream().filter(t -> !t.status().isLeft()).toList();
    }

    // ------------------------------------------------------------------ updates

    @Transactional
    public EmployeeResponse update(String id, EmployeeUpdateRequest req) {
        Employee e = find(id);
        if (req.expectedVersion() != null && req.expectedVersion() != e.getVersion()) {
            throw new ConflictException("Employee was modified by someone else (expected version " + req.expectedVersion() + ", current " + e.getVersion() + ")");
        }
        if (req.workEmail() != null && !req.workEmail().equalsIgnoreCase(e.getWorkEmail()) && employees.existsByWorkEmailIgnoreCase(req.workEmail())) {
            throw new ConflictException("Work e-mail already in use: " + req.workEmail());
        }
        EmployeeResponse before = toResponse(e);
        BeanMapper.copyNonNull(req, e);                       // partial update: only non-null request fields are copied
        return saveAndTrack(e, before, "UPDATED");
    }

    @Transactional
    public EmployeeResponse updateOwnContact(SelfContactUpdate req) {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        Employee e = find(me);
        EmployeeResponse before = toResponse(e);
        e.setContact(BeanMapper.toEntity(req.contact(), ContactInfo.class));
        return saveAndTrack(e, before, "CONTACT_UPDATED");
    }

    @Transactional
    public EmployeeResponse changeStatus(String id, StatusChangeRequest req) {
        Employee e = find(id);
        EmployeeStatus target = EmployeeStatus.valueOf(req.status());
        EmployeeStatus current = e.getStatus();
        if (current == target) throw new BadRequestException("Employee is already " + target);
        if (current.isLeft()) throw new BadRequestException("An employee who has " + current + " cannot change status again");
        EmployeeResponse before = toResponse(e);
        e.setStatus(target);
        LocalDate effective = req.effectiveDate() == null ? LocalDate.now() : req.effectiveDate();
        if (target.isLeft()) e.setExitDate(effective);
        employees.saveAndFlush(e);
        record(id, ChangeType.STATUS_CHANGE, current.name(), target.name(), effective, req.reason());
        if (target == EmployeeStatus.TERMINATED) producer.terminated(e, req.reason(), effective);
        else producer.updated(e, List.of("status"));
        EmployeeResponse after = toResponse(e);
        logChanges(id, before, after);
        audit.record("Employee", id, "STATUS_CHANGED", current.name(), target.name());
        evictAll(id);
        return after;
    }

    @Transactional
    public EmployeeResponse changeManager(String id, ManagerChangeRequest req) {
        Employee e = find(id);
        String newManager = req.managerId();
        if (newManager != null) {
            if (newManager.equals(id)) throw new BadRequestException("An employee cannot report to themself");
            requireActiveManager(newManager);
            assertNoReportingCycle(id, newManager);
        }
        String old = e.getManagerId();
        if (java.util.Objects.equals(old, newManager)) throw new BadRequestException("Manager is unchanged");
        EmployeeResponse before = toResponse(e);
        e.setManagerId(newManager);
        employees.saveAndFlush(e);
        record(id, ChangeType.MANAGER_CHANGE, old, newManager, LocalDate.now(), req.reason());
        producer.updated(e, List.of("managerId"));
        EmployeeResponse after = toResponse(e);
        logChanges(id, before, after);
        audit.record("Employee", id, "MANAGER_CHANGED", old, newManager);
        evictAll(id);
        evictAll(old == null ? id : old);
        return after;
    }

    @Transactional
    public EmployeeResponse transfer(String id, TransferRequest req) {
        if (req.departmentId() == null && req.designationId() == null && req.locationId() == null && req.jobGradeId() == null) {
            throw new BadRequestException("Provide at least one of departmentId, designationId, locationId, jobGradeId");
        }
        Employee e = find(id);
        validateOrganization(req.departmentId(), req.designationId(), req.locationId(), req.jobGradeId());
        EmployeeResponse before = toResponse(e);
        boolean promotion = Boolean.TRUE.equals(req.promotion()) || (req.designationId() != null && !req.designationId().equals(e.getDesignationId()));
        if (req.departmentId() != null) e.setDepartmentId(req.departmentId());
        if (req.designationId() != null) e.setDesignationId(req.designationId());
        if (req.locationId() != null) e.setLocationId(req.locationId());
        if (req.jobGradeId() != null) e.setJobGradeId(req.jobGradeId());
        employees.saveAndFlush(e);
        EmployeeResponse after = toResponse(e);
        List<Change> changes = FieldDiff.diff(before, after);
        record(id, promotion ? ChangeType.PROMOTION : ChangeType.TRANSFER, summarise(changes, true), summarise(changes, false), req.effectiveDate(), req.reason());
        producer.updated(e, changes.stream().map(Change::field).toList());
        logChanges(id, before, after);
        audit.record("Employee", id, promotion ? "PROMOTED" : "TRANSFERRED", before, after);
        evictAll(id);
        return after;
    }

    /** Called by the exit workflow consumers (no HTTP caller): resignation / exit completion. */
    @Transactional
    public void applyExitState(String employeeId, EmployeeStatus status, LocalDate exitDate) {
        employees.findById(employeeId).ifPresent(e -> {
            if (e.getStatus() == status || e.getStatus().isLeft()) return;
            EmployeeStatus old = e.getStatus();
            e.setStatus(status);
            if (status.isLeft() && exitDate != null) e.setExitDate(exitDate);
            employees.saveAndFlush(e);
            record(employeeId, ChangeType.STATUS_CHANGE, old.name(), status.name(), exitDate == null ? LocalDate.now() : exitDate, "Exit workflow");
            producer.updated(e, List.of("status"));
            audit.record("Employee", employeeId, "STATUS_CHANGED_BY_EXIT", old.name(), status.name());
            evictAll(employeeId);
        });
    }

    // ------------------------------------------------------------------ helpers

    private EmployeeResponse saveAndTrack(Employee e, EmployeeResponse before, String action) {
        employees.saveAndFlush(e);                                 // flush now: an optimistic-lock conflict surfaces here
        EmployeeResponse after = toResponse(e);
        List<Change> changes = FieldDiff.diff(before, after);
        if (!changes.isEmpty()) {
            logChanges(e.getId(), before, after);
            producer.updated(e, changes.stream().map(Change::field).toList());
            audit.record("Employee", e.getId(), action, before, after);
            evictAll(e.getId());
        }
        return after;
    }

    private void logChanges(String employeeId, EmployeeResponse before, EmployeeResponse after) {
        for (Change c : FieldDiff.diff(before, after)) {
            ProfileChangeLog l = new ProfileChangeLog();
            l.setEmployeeId(employeeId);
            l.setFieldName(c.field());
            l.setOldValue(c.oldValue());
            l.setNewValue(c.newValue());
            changeLog.save(l);
        }
    }

    private void record(String employeeId, ChangeType type, String from, String to, LocalDate effective, String reason) {
        EmploymentHistory h = new EmploymentHistory();
        h.setEmployeeId(employeeId);
        h.setChangeType(type);
        h.setFromValue(from);
        h.setToValue(to);
        h.setEffectiveDate(effective == null ? LocalDate.now() : effective);
        h.setReason(reason);
        history.save(h);
    }

    private static String summarise(List<Change> changes, boolean old) {
        return changes.stream().map(c -> c.field() + "=" + (old ? c.oldValue() : c.newValue())).reduce((a, b) -> a + "; " + b).orElse(null);
    }

    private void validateOrganization(String departmentId, String designationId, String locationId, String jobGradeId) {
        if (departmentId != null) requireActive("Department", () -> organization.department(departmentId));
        if (designationId != null) requireActive("Designation", () -> organization.designation(designationId));
        if (locationId != null) requireActive("Location", () -> organization.location(locationId));
        if (jobGradeId != null) requireActive("Job grade", () -> organization.jobGrade(jobGradeId));
    }

    private void requireActive(String what, Supplier<OrgRef> call) {
        OrgRef ref;
        try {
            ref = call.get();
        } catch (ResourceNotFoundException e) {
            throw new BadRequestException(what + " does not exist");
        } catch (FeignException e) {
            throw new ServiceUnavailableException("Organization service is unavailable - cannot validate " + what.toLowerCase());
        }
        if (Boolean.FALSE.equals(ref.active())) throw new BadRequestException(what + " is inactive");
    }

    private void requireActiveManager(String managerId) {
        Employee m = employees.findById(managerId).orElseThrow(() -> new BadRequestException("Manager does not exist: " + managerId));
        if (m.getStatus().isLeft()) throw new BadRequestException("Manager has already left the company");
    }

    /** Walk up from the proposed manager: if we meet the employee, the new line would make a loop (A reports to B reports to A). */
    private void assertNoReportingCycle(String employeeId, String newManagerId) {
        Set<String> seen = new HashSet<>();
        String cursor = newManagerId;
        while (cursor != null && seen.add(cursor)) {
            if (cursor.equals(employeeId)) throw new BadRequestException("This manager assignment would create a reporting loop");
            cursor = employees.findById(cursor).map(Employee::getManagerId).orElse(null);
        }
    }

    private void evictAll(String id) {
        cache.evict("employeeProfile", id);
        cache.clear("employeeDirectory");
    }

    public Employee find(String id) {
        return employees.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Employee", id));
    }

    EmployeeResponse toResponse(Employee e) {
        return BeanMapper.toRecord(e, EmployeeResponse.class);
    }

    static ContactDto emptyContact() {
        return new ContactDto(null, null, null);
    }
}
