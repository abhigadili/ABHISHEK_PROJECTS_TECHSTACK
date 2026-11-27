package com.hospital.patient.service;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.client.PatientSummary;
import com.hospital.common.events.PatientRegisteredEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.EventPublisher;
import com.hospital.common.security.CurrentUser;
import com.hospital.common.security.Role;
import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ForbiddenOperationException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.patient.domain.Patient;
import com.hospital.patient.domain.PatientRepository;
import com.hospital.patient.domain.PatientStatus;
import com.hospital.patient.dto.PatientDtos.PatientRequest;
import com.hospital.patient.dto.PatientDtos.PatientResponse;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class PatientService {
    private final PatientRepository patients;
    private final EventPublisher events;

    public PatientService(PatientRepository patients, EventPublisher events) {
        this.patients = patients;
        this.events = events;
    }

    /** Scenario 1: validate -> reject duplicates -> store -> publish PatientRegistered (outbox, same transaction). */
    @Transactional
    public PatientResponse register(PatientRequest r) {
        Long userId = CurrentUser.hasRole(Role.PATIENT) ? CurrentUser.id() : r.getUserId();
        if (userId != null && patients.existsByUserId(userId)) throw new ConflictException("A patient profile already exists for this login");
        if (patients.existsByEmailIgnoreCase(r.getEmail())) throw new ConflictException("A patient with email '" + r.getEmail() + "' is already registered");
        if (patients.existsByPhone(r.getPhone())) throw new ConflictException("A patient with phone '" + r.getPhone() + "' is already registered");
        if (r.getIdentityNumber() != null && !r.getIdentityNumber().isBlank() && patients.existsByIdentityNumber(r.getIdentityNumber())) {
            throw new ConflictException("A patient with identity number '" + r.getIdentityNumber() + "' is already registered");
        }
        Patient p = new Patient();
        p.setUserId(userId);
        apply(p, r);
        try {
            p = patients.saveAndFlush(p);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Duplicate patient (email, phone or identity number already registered)");
        }
        events.publish(Topics.PATIENT_REGISTERED, String.valueOf(p.getId()), new PatientRegisteredEvent(EventPublisher.newId(),
                EventPublisher.now(), p.getId(), p.getUserId(), p.getFirstName(), p.getLastName(), p.getEmail(), p.getPhone()));
        log.info("Registered patient {} ({})", p.getId(), p.fullName());
        return PatientResponse.from(p);
    }

    @Cacheable(cacheNames = "patients", key = "#id")
    @Transactional(readOnly = true)
    public PatientResponse get(Long id) {
        return PatientResponse.from(find(id));
    }

    /** Applies the ownership rule: patients may only touch their own profile. */
    public PatientResponse getAuthorized(Long id) {
        PatientResponse p = get(id);
        assertOwnerOrStaff(p.getUserId());
        return p;
    }

    @Transactional(readOnly = true)
    public PatientResponse byUserAuthorized(Long userId) {
        Patient p = patients.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("No patient profile for user " + userId));
        assertOwnerOrStaff(p.getUserId());
        return PatientResponse.from(p);
    }

    /** Minimal projection for other services (Feign callers). Cached. */
    @Cacheable(cacheNames = "patientSummaries", key = "#id")
    @Transactional(readOnly = true)
    public PatientSummary summary(Long id) {
        return toSummary(find(id));
    }

    @Transactional(readOnly = true)
    public PatientSummary summaryByUser(Long userId) {
        return toSummary(patients.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("No patient profile for user " + userId)));
    }

    @Transactional(readOnly = true)
    public Page<PatientResponse> search(String q, int page, int size) {
        String term = q == null || q.isBlank() ? null : q.trim();
        return patients.search(term, PageRequest.of(page, Math.min(size, 100), Sort.by("lastName", "firstName"))).map(PatientResponse::from);
    }

    @Caching(put = @CachePut(cacheNames = "patients", key = "#id"), evict = @CacheEvict(cacheNames = "patientSummaries", key = "#id"))
    @Transactional
    public PatientResponse update(Long id, PatientRequest r) {
        Patient p = find(id);
        assertOwnerOrStaff(p.getUserId());
        if (!p.getEmail().equalsIgnoreCase(r.getEmail()) && patients.existsByEmailIgnoreCase(r.getEmail())) throw new ConflictException("Email '" + r.getEmail() + "' belongs to another patient");
        if (!p.getPhone().equals(r.getPhone()) && patients.existsByPhone(r.getPhone())) throw new ConflictException("Phone '" + r.getPhone() + "' belongs to another patient");
        String ident = r.getIdentityNumber() == null || r.getIdentityNumber().isBlank() ? null : r.getIdentityNumber();
        if (ident != null && !ident.equals(p.getIdentityNumber()) && patients.existsByIdentityNumber(ident)) throw new ConflictException("Identity number belongs to another patient");
        apply(p, r);
        try {
            patients.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Duplicate patient data");
        }
        return PatientResponse.from(p);
    }

    @Caching(evict = {@CacheEvict(cacheNames = "patients", key = "#id"), @CacheEvict(cacheNames = "patientSummaries", key = "#id")})
    @Transactional
    public void deactivate(Long id) {
        find(id).setStatus(PatientStatus.INACTIVE);
    }

    private Patient find(Long id) {
        return patients.findById(id).orElseThrow(() -> new ResourceNotFoundException("Patient " + id + " not found"));
    }

    private static void assertOwnerOrStaff(Long ownerUserId) {
        if (CurrentUser.hasRole(Role.PATIENT) && !CurrentUser.isAdmin()) {
            Long uid = CurrentUser.id();
            if (uid == null || !uid.equals(ownerUserId)) throw new ForbiddenOperationException("Patients may only access their own profile");
        }
    }

    private static PatientSummary toSummary(Patient p) {
        return new PatientSummary(p.getId(), p.getUserId(), p.fullName(), p.getEmail(), p.getPhone(), p.getStatus().name());
    }

    private static void apply(Patient p, PatientRequest r) {
        p.setFirstName(r.getFirstName().trim());
        p.setLastName(r.getLastName().trim());
        p.setDateOfBirth(r.getDateOfBirth());
        p.setGender(r.getGender());
        p.setEmail(r.getEmail().trim().toLowerCase());
        p.setPhone(r.getPhone());
        p.setIdentityNumber(r.getIdentityNumber() == null || r.getIdentityNumber().isBlank() ? null : r.getIdentityNumber().trim());
        p.setBloodGroup(r.getBloodGroup());
        p.setAddress(r.getAddress());
        p.setEmergencyContactName(r.getEmergencyContactName());
        p.setEmergencyContactPhone(r.getEmergencyContactPhone());
        p.setKnownAllergies(r.getKnownAllergies());
    }
}
