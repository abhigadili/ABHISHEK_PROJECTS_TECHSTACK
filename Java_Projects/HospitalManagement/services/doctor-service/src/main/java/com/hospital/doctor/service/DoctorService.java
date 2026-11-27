package com.hospital.doctor.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.security.CurrentUser;
import com.hospital.common.security.Role;
import com.hospital.common.web.BadRequestException;
import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ForbiddenOperationException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.doctor.client.HospitalGateway;
import com.hospital.doctor.domain.*;
import com.hospital.doctor.dto.DoctorDtos.*;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class DoctorService {
    private final DoctorRepository doctors;
    private final DoctorScheduleRepository schedules;
    private final DoctorUnavailabilityRepository unavailability;
    private final HospitalGateway hospitals;
    private final SlotService slotService;

    public DoctorService(DoctorRepository doctors, DoctorScheduleRepository schedules, DoctorUnavailabilityRepository unavailability,
                         HospitalGateway hospitals, SlotService slotService) {
        this.doctors = doctors;
        this.schedules = schedules;
        this.unavailability = unavailability;
        this.hospitals = hospitals;
        this.slotService = slotService;
    }

    @Transactional
    public DoctorResponse create(DoctorRequest r) {
        if (doctors.existsByLicenseNumber(r.getLicenseNumber())) throw new ConflictException("License number '" + r.getLicenseNumber() + "' is already registered");
        if (doctors.existsByEmailIgnoreCase(r.getEmail())) throw new ConflictException("Email '" + r.getEmail() + "' is already registered");
        if (r.getUserId() != null && doctors.existsByUserId(r.getUserId())) throw new ConflictException("This login already belongs to another doctor");
        hospitals.validate(r.getHospitalId(), r.getDepartmentId());   // OpenFeign + circuit breaker
        Doctor d = new Doctor();
        d.setUserId(r.getUserId());
        apply(d, r);
        try {
            d = doctors.saveAndFlush(d);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Duplicate doctor (license, email or login)");
        }
        log.info("Created doctor {} ({})", d.getId(), d.fullName());
        return DoctorResponse.from(d);
    }

    @Cacheable(cacheNames = "doctors", key = "#id")
    @Transactional(readOnly = true)
    public DoctorResponse get(Long id) {
        return DoctorResponse.from(find(id));
    }

    @CachePut(cacheNames = "doctors", key = "#id")
    @Transactional
    public DoctorResponse update(Long id, DoctorRequest r) {
        Doctor d = find(id);
        if (!d.getLicenseNumber().equals(r.getLicenseNumber()) && doctors.existsByLicenseNumber(r.getLicenseNumber())) throw new ConflictException("License number already registered");
        if (!d.getEmail().equalsIgnoreCase(r.getEmail()) && doctors.existsByEmailIgnoreCase(r.getEmail())) throw new ConflictException("Email already registered");
        if (r.getUserId() != null && !r.getUserId().equals(d.getUserId())) {
            if (doctors.existsByUserId(r.getUserId())) throw new ConflictException("This login already belongs to another doctor");
            d.setUserId(r.getUserId());
        }
        hospitals.validate(r.getHospitalId(), r.getDepartmentId());
        apply(d, r);
        return DoctorResponse.from(d);
    }

    @CacheEvict(cacheNames = {"doctors", "doctorSlots"}, allEntries = true)
    @Transactional
    public void deactivate(Long id) {
        find(id).setActive(false);
    }

    @Transactional(readOnly = true)
    public Page<DoctorResponse> search(String specialization, Long hospitalId, Long departmentId, Boolean active, int page, int size) {
        String spec = specialization == null || specialization.isBlank() ? null : specialization.trim();
        return doctors.search(spec, hospitalId, departmentId, active == null ? Boolean.TRUE : active,
                PageRequest.of(page, Math.min(size, 100), Sort.by("lastName", "firstName"))).map(DoctorResponse::from);
    }

    @Transactional(readOnly = true)
    public List<String> specializations() {
        return doctors.specializations();
    }

    /** Scenario 2: doctors who actually work on that date (weekly template + no day off), with their slot counts. */
    @Transactional(readOnly = true)
    public List<AvailableDoctor> availableOn(LocalDate date, String specialization) {
        String spec = specialization == null || specialization.isBlank() ? null : specialization.trim();
        return doctors.findWorkingOn(date.getDayOfWeek(), date, spec).stream().map(d -> {
            List<SlotDto> slots = slotService.slots(d.getId(), date);   // via proxy -> Redis cache
            return new AvailableDoctor(DoctorResponse.from(d), slots.size(),
                    slots.isEmpty() ? null : slots.get(0).getStartTime(), slots.isEmpty() ? null : slots.get(slots.size() - 1).getEndTime());
        }).filter(a -> a.getSlotCount() > 0).toList();
    }

    public List<SlotDto> slots(Long doctorId, LocalDate date) {
        return slotService.slots(doctorId, date);
    }

    // ---- schedule management (Scenario 3) -------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ScheduleEntry> schedule(Long doctorId) {
        find(doctorId);
        return schedules.findByDoctorIdOrderByDayOfWeek(doctorId).stream().map(ScheduleEntry::from).toList();
    }

    /** Replaces the weekly template. */
    @CacheEvict(cacheNames = "doctorSlots", allEntries = true)
    @Transactional
    public List<ScheduleEntry> replaceSchedule(Long doctorId, ScheduleRequest req) {
        Doctor d = find(doctorId);
        assertCanManage(d);
        Set<java.time.DayOfWeek> seen = new HashSet<>();
        for (ScheduleEntry e : req.getDays()) {
            if (!seen.add(e.getDayOfWeek())) throw new BadRequestException("Duplicate entry for " + e.getDayOfWeek());
            validate(e);
        }
        schedules.deleteByDoctorId(doctorId);
        schedules.flush();
        for (ScheduleEntry e : req.getDays()) {
            DoctorSchedule s = new DoctorSchedule();
            s.setDoctor(d);
            s.setDayOfWeek(e.getDayOfWeek());
            s.setStartTime(e.getStartTime());
            s.setEndTime(e.getEndTime());
            s.setSlotMinutes(e.getSlotMinutes());
            s.setBreakStart(e.getBreakStart());
            s.setBreakEnd(e.getBreakEnd());
            schedules.save(s);
        }
        log.info("Schedule of doctor {} replaced ({} working days)", doctorId, req.getDays().size());
        return schedule(doctorId);
    }

    @Transactional(readOnly = true)
    public List<UnavailabilityResponse> unavailability(Long doctorId) {
        find(doctorId);
        return unavailability.findByDoctorIdAndUnavailableDateGreaterThanEqualOrderByUnavailableDate(doctorId, LocalDate.now())
                .stream().map(UnavailabilityResponse::from).toList();
    }

    @CacheEvict(cacheNames = "doctorSlots", allEntries = true)
    @Transactional
    public UnavailabilityResponse addUnavailability(Long doctorId, UnavailabilityRequest req) {
        Doctor d = find(doctorId);
        assertCanManage(d);
        if (req.getDate().isBefore(LocalDate.now())) throw new BadRequestException("Cannot mark a past date as unavailable");
        if (unavailability.existsByDoctorIdAndUnavailableDate(doctorId, req.getDate())) throw new ConflictException("Date " + req.getDate() + " is already marked unavailable");
        DoctorUnavailability u = new DoctorUnavailability();
        u.setDoctor(d);
        u.setUnavailableDate(req.getDate());
        u.setReason(req.getReason());
        return UnavailabilityResponse.from(unavailability.save(u));
    }

    @CacheEvict(cacheNames = "doctorSlots", allEntries = true)
    @Transactional
    public void removeUnavailability(Long doctorId, Long unavailabilityId) {
        Doctor d = find(doctorId);
        assertCanManage(d);
        DoctorUnavailability u = unavailability.findById(unavailabilityId)
                .filter(x -> x.getDoctor().getId().equals(doctorId)).orElseThrow(() -> new ResourceNotFoundException("Unavailability " + unavailabilityId + " not found"));
        unavailability.delete(u);
    }

    private static void validate(ScheduleEntry e) {
        if (!e.getStartTime().isBefore(e.getEndTime())) throw new BadRequestException(e.getDayOfWeek() + ": startTime must be before endTime");
        if ((e.getBreakStart() == null) != (e.getBreakEnd() == null)) throw new BadRequestException(e.getDayOfWeek() + ": breakStart and breakEnd must be given together");
        if (e.getBreakStart() != null) {
            LocalTime bs = e.getBreakStart(), be = e.getBreakEnd();
            if (!bs.isBefore(be) || bs.isBefore(e.getStartTime()) || be.isAfter(e.getEndTime())) {
                throw new BadRequestException(e.getDayOfWeek() + ": break must lie inside working hours and start before it ends");
            }
        }
        if (java.time.Duration.between(e.getStartTime(), e.getEndTime()).toMinutes() < e.getSlotMinutes()) {
            throw new BadRequestException(e.getDayOfWeek() + ": working hours are shorter than one slot");
        }
    }

    /** Admin/hospital staff may manage anyone's availability; a doctor only their own. */
    private static void assertCanManage(Doctor d) {
        if (CurrentUser.isAdmin()) return;
        if (CurrentUser.hasRole(Role.DOCTOR) && d.getUserId() != null && d.getUserId().equals(CurrentUser.id())) return;
        throw new ForbiddenOperationException("Only an administrator or the doctor concerned can change this availability");
    }

    private Doctor find(Long id) {
        return doctors.findById(id).orElseThrow(() -> new ResourceNotFoundException("Doctor " + id + " not found"));
    }

    private static void apply(Doctor d, DoctorRequest r) {
        d.setFirstName(r.getFirstName().trim());
        d.setLastName(r.getLastName().trim());
        d.setEmail(r.getEmail().trim().toLowerCase());
        d.setPhone(r.getPhone());
        d.setLicenseNumber(r.getLicenseNumber().trim());
        d.setSpecialization(r.getSpecialization().trim());
        d.setQualification(r.getQualification());
        d.setExperienceYears(r.getExperienceYears());
        d.setConsultationFee(r.getConsultationFee());
        d.setHospitalId(r.getHospitalId());
        d.setDepartmentId(r.getDepartmentId());
    }
}
