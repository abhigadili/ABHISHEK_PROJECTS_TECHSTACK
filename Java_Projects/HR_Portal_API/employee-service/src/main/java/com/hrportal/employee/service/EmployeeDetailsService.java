package com.hrportal.employee.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.common.util.LogMasker;
import com.hrportal.employee.dto.EmployeeDtos.AddressRequest;
import com.hrportal.employee.dto.EmployeeDtos.AddressResponse;
import com.hrportal.employee.dto.EmployeeDtos.BankDetailRequest;
import com.hrportal.employee.dto.EmployeeDtos.BankDetailResponse;
import com.hrportal.employee.dto.EmployeeDtos.EducationRequest;
import com.hrportal.employee.dto.EmployeeDtos.EducationResponse;
import com.hrportal.employee.dto.EmployeeDtos.EmergencyContactRequest;
import com.hrportal.employee.dto.EmployeeDtos.EmergencyContactResponse;
import com.hrportal.employee.dto.EmployeeDtos.EmploymentHistoryResponse;
import com.hrportal.employee.dto.EmployeeDtos.ExperienceRequest;
import com.hrportal.employee.dto.EmployeeDtos.ExperienceResponse;
import com.hrportal.employee.dto.EmployeeDtos.ProfileChangeResponse;
import com.hrportal.employee.dto.EmployeeDtos.StatusHistoryResponse;
import com.hrportal.employee.entity.Employee;
import com.hrportal.employee.entity.EmployeeAddress;
import com.hrportal.employee.entity.EmployeeBankDetail;
import com.hrportal.employee.entity.EmployeeEducation;
import com.hrportal.employee.entity.EmployeeExperience;
import com.hrportal.employee.entity.EmergencyContact;
import com.hrportal.employee.repository.ChildRepositories.BankDetailRepository;
import com.hrportal.employee.repository.ChildRepositories.EducationRepository;
import com.hrportal.employee.repository.ChildRepositories.EmploymentHistoryRepository;
import com.hrportal.employee.repository.ChildRepositories.ExperienceRepository;
import com.hrportal.employee.repository.ChildRepositories.ProfileChangeLogRepository;
import com.hrportal.employee.repository.ChildRepositories.StatusHistoryRepository;
import com.hrportal.employee.repository.EmployeeRepository;

/**
 * Sub-resources of an employee: addresses, emergency contacts (One-to-Many through the aggregate), education
 * (Many-to-One), experience, bank details (One-to-One, encrypted + masked) and the history views.
 */
@Service
@Transactional
public class EmployeeDetailsService {
    private final EmployeeRepository employees;
    private final EducationRepository education;
    private final ExperienceRepository experience;
    private final BankDetailRepository banks;
    private final EmploymentHistoryRepository history;
    private final ProfileChangeLogRepository changeLog;
    private final StatusHistoryRepository statusHistory;
    private final EmployeeAccess access;
    private final AuditService audit;

    public EmployeeDetailsService(EmployeeRepository employees, EducationRepository education, ExperienceRepository experience,
                                  BankDetailRepository banks, EmploymentHistoryRepository history, ProfileChangeLogRepository changeLog,
                                  StatusHistoryRepository statusHistory, EmployeeAccess access, AuditService audit) {
        this.employees = employees;
        this.education = education;
        this.experience = experience;
        this.banks = banks;
        this.history = history;
        this.changeLog = changeLog;
        this.statusHistory = statusHistory;
        this.access = access;
        this.audit = audit;
    }

    // ---------------------------------------------------------------- addresses
    @Transactional(readOnly = true)
    public List<AddressResponse> addresses(String employeeId) {
        access.requireSelfOrHr(employeeId);
        return BeanMapper.toRecords(withAddresses(employeeId).getAddresses(), AddressResponse.class);
    }

    public AddressResponse addAddress(String employeeId, AddressRequest req) {
        access.requireSelfOrHr(employeeId);
        Employee e = withAddresses(employeeId);
        EmployeeAddress a = BeanMapper.toEntity(req, EmployeeAddress.class);
        if (a.isPrimaryAddress()) e.getAddresses().forEach(o -> o.setPrimaryAddress(false));
        e.getAddresses().add(a);
        employees.saveAndFlush(e);
        audit.record("EmployeeAddress", a.getId(), "ADDED", employeeId, BeanMapper.toRecord(a, AddressResponse.class));
        return BeanMapper.toRecord(a, AddressResponse.class);
    }

    public AddressResponse updateAddress(String employeeId, String addressId, AddressRequest req) {
        access.requireSelfOrHr(employeeId);
        Employee e = withAddresses(employeeId);
        EmployeeAddress a = e.getAddresses().stream().filter(x -> x.getId().equals(addressId)).findFirst()
                .orElseThrow(() -> ResourceNotFoundException.of("Address", addressId));
        BeanMapper.copyNonNull(req, a);
        if (a.isPrimaryAddress()) e.getAddresses().stream().filter(o -> o != a).forEach(o -> o.setPrimaryAddress(false));
        employees.saveAndFlush(e);
        return BeanMapper.toRecord(a, AddressResponse.class);
    }

    public void deleteAddress(String employeeId, String addressId) {
        access.requireSelfOrHr(employeeId);
        Employee e = withAddresses(employeeId);
        if (!e.getAddresses().removeIf(x -> x.getId().equals(addressId))) throw ResourceNotFoundException.of("Address", addressId);
        employees.saveAndFlush(e);          // orphanRemoval deletes the row
        audit.record("EmployeeAddress", addressId, "DELETED", employeeId, null);
    }

    private Employee withAddresses(String id) {
        return employees.findWithAddressesById(id).orElseThrow(() -> ResourceNotFoundException.of("Employee", id));
    }

    // ---------------------------------------------------------------- emergency contacts
    @Transactional(readOnly = true)
    public List<EmergencyContactResponse> contacts(String employeeId) {
        access.requireSelfOrHr(employeeId);
        return BeanMapper.toRecords(withContacts(employeeId).getEmergencyContacts(), EmergencyContactResponse.class);
    }

    public EmergencyContactResponse addContact(String employeeId, EmergencyContactRequest req) {
        access.requireSelfOrHr(employeeId);
        Employee e = withContacts(employeeId);
        EmergencyContact c = BeanMapper.toEntity(req, EmergencyContact.class);
        if (c.isPrimaryContact()) e.getEmergencyContacts().forEach(o -> o.setPrimaryContact(false));
        e.getEmergencyContacts().add(c);
        employees.saveAndFlush(e);
        return BeanMapper.toRecord(c, EmergencyContactResponse.class);
    }

    public EmergencyContactResponse updateContact(String employeeId, String contactId, EmergencyContactRequest req) {
        access.requireSelfOrHr(employeeId);
        Employee e = withContacts(employeeId);
        EmergencyContact c = e.getEmergencyContacts().stream().filter(x -> x.getId().equals(contactId)).findFirst()
                .orElseThrow(() -> ResourceNotFoundException.of("Emergency contact", contactId));
        BeanMapper.copyNonNull(req, c);
        if (c.isPrimaryContact()) e.getEmergencyContacts().stream().filter(o -> o != c).forEach(o -> o.setPrimaryContact(false));
        employees.saveAndFlush(e);
        return BeanMapper.toRecord(c, EmergencyContactResponse.class);
    }

    public void deleteContact(String employeeId, String contactId) {
        access.requireSelfOrHr(employeeId);
        Employee e = withContacts(employeeId);
        if (!e.getEmergencyContacts().removeIf(x -> x.getId().equals(contactId))) throw ResourceNotFoundException.of("Emergency contact", contactId);
        employees.saveAndFlush(e);
    }

    private Employee withContacts(String id) {
        return employees.findWithEmergencyContactsById(id).orElseThrow(() -> ResourceNotFoundException.of("Employee", id));
    }

    // ---------------------------------------------------------------- education
    @Transactional(readOnly = true)
    public List<EducationResponse> education(String employeeId) {
        access.requireSelfOrHr(employeeId);
        return BeanMapper.toRecords(education.findByEmployee_IdOrderByEndYearDesc(employeeId), EducationResponse.class);
    }

    public EducationResponse addEducation(String employeeId, EducationRequest req) {
        access.requireSelfOrHr(employeeId);
        requireExists(employeeId);
        EmployeeEducation ed = BeanMapper.toEntity(req, EmployeeEducation.class);
        ed.setEmployee(employees.getReferenceById(employeeId));      // proxy only: no SELECT needed to set the FK
        ed.setEmployeeId(employeeId);
        education.save(ed);
        return BeanMapper.toRecord(ed, EducationResponse.class);
    }

    public EducationResponse updateEducation(String employeeId, String id, EducationRequest req) {
        access.requireSelfOrHr(employeeId);
        EmployeeEducation ed = education.findByIdAndEmployee_Id(id, employeeId).orElseThrow(() -> ResourceNotFoundException.of("Education", id));
        BeanMapper.copyNonNull(req, ed);
        return BeanMapper.toRecord(education.save(ed), EducationResponse.class);
    }

    public void deleteEducation(String employeeId, String id) {
        access.requireSelfOrHr(employeeId);
        education.delete(education.findByIdAndEmployee_Id(id, employeeId).orElseThrow(() -> ResourceNotFoundException.of("Education", id)));
    }

    // ---------------------------------------------------------------- experience
    @Transactional(readOnly = true)
    public List<ExperienceResponse> experience(String employeeId) {
        access.requireSelfOrHr(employeeId);
        return BeanMapper.toRecords(experience.findByEmployeeIdOrderByStartDateDesc(employeeId), ExperienceResponse.class);
    }

    public ExperienceResponse addExperience(String employeeId, ExperienceRequest req) {
        access.requireSelfOrHr(employeeId);
        requireExists(employeeId);
        EmployeeExperience x = BeanMapper.toEntity(req, EmployeeExperience.class);
        x.setEmployeeId(employeeId);
        return BeanMapper.toRecord(experience.save(x), ExperienceResponse.class);
    }

    public ExperienceResponse updateExperience(String employeeId, String id, ExperienceRequest req) {
        access.requireSelfOrHr(employeeId);
        EmployeeExperience x = experience.findByIdAndEmployeeId(id, employeeId).orElseThrow(() -> ResourceNotFoundException.of("Experience", id));
        BeanMapper.copyNonNull(req, x);
        return BeanMapper.toRecord(experience.save(x), ExperienceResponse.class);
    }

    public void deleteExperience(String employeeId, String id) {
        access.requireSelfOrHr(employeeId);
        experience.delete(experience.findByIdAndEmployeeId(id, employeeId).orElseThrow(() -> ResourceNotFoundException.of("Experience", id)));
    }

    // ---------------------------------------------------------------- bank details (never cached, never logged in clear)
    @Transactional(readOnly = true)
    public BankDetailResponse bank(String employeeId) {
        requireBankAccess(employeeId);
        return banks.findByEmployee_Id(employeeId).map(this::toBank).orElseThrow(() -> ResourceNotFoundException.of("Bank details of employee", employeeId));
    }

    public BankDetailResponse saveBank(String employeeId, BankDetailRequest req) {
        access.requireSelfOrHr(employeeId);
        EmployeeBankDetail b = banks.findByEmployee_Id(employeeId).orElseGet(() -> {
            EmployeeBankDetail n = new EmployeeBankDetail();
            n.setEmployee(employees.findById(employeeId).orElseThrow(() -> ResourceNotFoundException.of("Employee", employeeId)));
            n.setEmployeeId(employeeId);
            return n;
        });
        BeanMapper.copyNonNull(req, b);
        b = banks.save(b);
        audit.record("EmployeeBankDetail", b.getId(), "SAVED", employeeId, toBank(b));    // masked values only
        return toBank(b);
    }

    private void requireBankAccess(String employeeId) {
        if (CurrentUser.hasAnyRole(Role.PAYROLL_ADMIN)) return;
        access.requireSelfOrHr(employeeId);
    }

    private BankDetailResponse toBank(EmployeeBankDetail b) {
        return new BankDetailResponse(b.getId(), b.getEmployeeId() != null ? b.getEmployeeId() : b.getEmployee().getId(), b.getBankName(), b.getBranch(),
                b.getAccountHolderName(), LogMasker.maskTail(b.getAccountNumber(), 4),
                b.getIfscCode() == null ? null : LogMasker.maskTail(b.getIfscCode(), 4), b.getAccountType(), b.getUpdatedAt());
    }

    // ---------------------------------------------------------------- history
    @Transactional(readOnly = true)
    public List<EmploymentHistoryResponse> employmentHistory(String employeeId) {
        Employee e = employees.findById(employeeId).orElseThrow(() -> ResourceNotFoundException.of("Employee", employeeId));
        access.requireSelfOrHrOrManagerOf(employeeId, e.getManagerId());
        return BeanMapper.toRecords(history.findByEmployeeIdOrderByEffectiveDateDescCreatedAtDesc(employeeId), EmploymentHistoryResponse.class);
    }

    @Transactional(readOnly = true)
    public Page<ProfileChangeResponse> profileHistory(String employeeId, Pageable pageable) {
        access.requireSelfOrHr(employeeId);
        return changeLog.findByEmployeeId(employeeId, pageable).map(l -> BeanMapper.toRecord(l, ProfileChangeResponse.class));
    }

    @Transactional(readOnly = true)
    public List<StatusHistoryResponse> statusHistory(String employeeId) {
        if (!CurrentUser.isHr()) throw new ForbiddenOperationException("Only HR can read the status history");
        return BeanMapper.toRecords(statusHistory.findByEmployeeIdOrderByChangedAtDesc(employeeId), StatusHistoryResponse.class);
    }

    private void requireExists(String employeeId) {
        if (!employees.existsById(employeeId)) throw ResourceNotFoundException.of("Employee", employeeId);
    }
}
