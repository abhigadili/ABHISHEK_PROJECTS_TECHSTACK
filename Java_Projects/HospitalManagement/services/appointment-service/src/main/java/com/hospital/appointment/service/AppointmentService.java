package com.hospital.appointment.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.appointment.domain.*;
import com.hospital.appointment.dto.AppointmentDtos.*;
import com.hospital.common.client.DoctorGateway;
import com.hospital.common.client.DoctorView;
import com.hospital.common.client.PatientGateway;
import com.hospital.common.client.PatientSummary;
import com.hospital.common.client.SlotView;
import com.hospital.common.events.*;
import com.hospital.common.kafka.EventPublisher;
import com.hospital.common.security.CurrentUser;
import com.hospital.common.security.Role;
import com.hospital.common.web.BadRequestException;
import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ForbiddenOperationException;
import com.hospital.common.web.ResourceNotFoundException;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class AppointmentService {
    private final AppointmentRepository appointments;
    private final PatientGateway patients;      // OpenFeign + Resilience4j
    private final DoctorGateway doctors;        // WebClient + Resilience4j
    private final EventPublisher events;
    private final CacheEvictor cache;

    public AppointmentService(AppointmentRepository appointments, PatientGateway patients, DoctorGateway doctors,
                              EventPublisher events, CacheEvictor cache) {
        this.appointments = appointments;
        this.patients = patients;
        this.doctors = doctors;
        this.events = events;
        this.cache = cache;
    }

    // ---- availability (Scenario 2 + 3) --------------------------------------------------------------------

    /** Doctor's slot grid (WebClient -> Doctor Service) minus booked and already-elapsed slots. Cached 60s, evicted on book/cancel/reschedule. */
    @Cacheable(cacheNames = CacheEvictor.AVAILABILITY, key = "#doctorId + ':' + #date")
    @Transactional(readOnly = true)
    public List<SlotView> availability(Long doctorId, LocalDate date) {
        List<SlotView> grid = doctors.slots(doctorId, date);
        List<Appointment> booked = appointments.findByDoctorIdAndAppointmentDateAndStatus(doctorId, date, AppointmentStatus.BOOKED);
        LocalDateTime now = LocalDateTime.now();
        for (SlotView s : grid) {
            boolean taken = booked.stream().anyMatch(a -> a.getStartTime().isBefore(s.getEndTime()) && a.getEndTime().isAfter(s.getStartTime()));
            boolean elapsed = LocalDateTime.of(date, s.getStartTime()).isBefore(now);
            s.setAvailable(!taken && !elapsed);
        }
        return grid;
    }

    // ---- booking ------------------------------------------------------------------------------------------

    @Transactional
    public AppointmentResponse book(BookRequest r) {
        PatientSummary patient = patients.requireAccess(r.getPatientId());
        if (!"ACTIVE".equals(patient.getStatus())) throw new BadRequestException("Patient " + patient.getId() + " is not active");
        DoctorView doctor = doctors.doctor(r.getDoctorId());
        if (!doctor.isActive()) throw new BadRequestException("Doctor " + doctor.getId() + " is not accepting appointments");
        SlotView slot = resolveSlot(r.getDoctorId(), r.getDate(), r.getStartTime());
        assertFree(r.getDoctorId(), patient.getId(), r.getDate(), slot, null);

        Appointment a = new Appointment();
        a.setPatientId(patient.getId());
        a.setPatientName(patient.getFullName());
        a.setPatientEmail(patient.getEmail());
        a.setDoctorId(doctor.getId());
        a.setDoctorName(doctor.getFullName());
        a.setDoctorEmail(doctor.getEmail());
        a.setFee(doctor.getConsultationFee() == null ? java.math.BigDecimal.ZERO : doctor.getConsultationFee());
        a.setAppointmentDate(r.getDate());
        a.setStartTime(slot.getStartTime());
        a.setEndTime(slot.getEndTime());
        a.setSlotKey(Appointment.slotKey(doctor.getId(), r.getDate(), slot.getStartTime()));
        a.setReason(r.getReason());
        try {
            a = appointments.saveAndFlush(a);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("This slot has just been booked by someone else");
        }
        cache.availability(a.getDoctorId(), a.getAppointmentDate());
        events.publish(Topics.APPOINTMENT_BOOKED, String.valueOf(a.getId()), new AppointmentBookedEvent(EventPublisher.newId(), EventPublisher.now(),
                a.getId(), a.getPatientId(), a.getPatientName(), a.getPatientEmail(), a.getDoctorId(), a.getDoctorName(), a.getDoctorEmail(),
                a.getAppointmentDate(), a.getStartTime(), a.getEndTime(), a.getFee()));
        log.info("Booked appointment {} doctor={} patient={} {} {}", a.getId(), a.getDoctorId(), a.getPatientId(), a.getAppointmentDate(), a.getStartTime());
        return AppointmentResponse.from(a);
    }

    @Transactional
    public AppointmentResponse reschedule(Long id, RescheduleRequest r) {
        Appointment a = find(id);
        authorizeParticipant(a);
        if (a.getStatus() != AppointmentStatus.BOOKED) throw new ConflictException("Only BOOKED appointments can be rescheduled (current: " + a.getStatus() + ")");
        SlotView slot = resolveSlot(a.getDoctorId(), r.getDate(), r.getStartTime());
        assertFree(a.getDoctorId(), a.getPatientId(), r.getDate(), slot, a.getId());

        LocalDate oldDate = a.getAppointmentDate();
        LocalTime oldStart = a.getStartTime();
        a.setAppointmentDate(r.getDate());
        a.setStartTime(slot.getStartTime());
        a.setEndTime(slot.getEndTime());
        a.setSlotKey(Appointment.slotKey(a.getDoctorId(), r.getDate(), slot.getStartTime()));
        a.setReminderSent(false);
        try {
            appointments.saveAndFlush(a);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("The requested slot has just been booked by someone else");
        }
        cache.availability(a.getDoctorId(), oldDate);
        cache.availability(a.getDoctorId(), a.getAppointmentDate());
        cache.appointment(a.getId());
        events.publish(Topics.APPOINTMENT_RESCHEDULED, String.valueOf(a.getId()), new AppointmentRescheduledEvent(EventPublisher.newId(), EventPublisher.now(),
                a.getId(), a.getPatientId(), a.getPatientName(), a.getPatientEmail(), a.getDoctorId(), a.getDoctorName(), a.getDoctorEmail(),
                oldDate, oldStart, a.getAppointmentDate(), a.getStartTime(), a.getEndTime()));
        log.info("Rescheduled appointment {} from {} {} to {} {}", id, oldDate, oldStart, a.getAppointmentDate(), a.getStartTime());
        return AppointmentResponse.from(a);
    }

    @Transactional
    public AppointmentResponse cancel(Long id, String reason) {
        Appointment a = find(id);
        authorizeParticipant(a);
        if (a.getStatus() != AppointmentStatus.BOOKED) throw new ConflictException("Only BOOKED appointments can be cancelled (current: " + a.getStatus() + ")");
        if (a.startsAt().isBefore(LocalDateTime.now())) throw new BadRequestException("The appointment time has already passed");
        a.setStatus(AppointmentStatus.CANCELLED);
        a.setSlotKey(null);                    // frees the slot for new bookings
        a.setCancelReason(reason);
        appointments.saveAndFlush(a);
        cache.availability(a.getDoctorId(), a.getAppointmentDate());
        cache.appointment(a.getId());
        String by = CurrentUser.username() == null ? "system" : CurrentUser.username();
        events.publish(Topics.APPOINTMENT_CANCELLED, String.valueOf(a.getId()), new AppointmentCancelledEvent(EventPublisher.newId(), EventPublisher.now(),
                a.getId(), a.getPatientId(), a.getPatientName(), a.getPatientEmail(), a.getDoctorId(), a.getDoctorName(), a.getDoctorEmail(),
                a.getAppointmentDate(), a.getStartTime(), by, reason));
        log.info("Cancelled appointment {} by {}", id, by);
        return AppointmentResponse.from(a);
    }

    @Transactional
    public AppointmentResponse complete(Long id, String notes) {
        Appointment a = find(id);
        if (!CurrentUser.isAdmin()) {
            DoctorView d = doctors.doctor(a.getDoctorId());
            if (d.getUserId() == null || !d.getUserId().equals(CurrentUser.id())) {
                throw new ForbiddenOperationException("Only the treating doctor can complete this appointment");
            }
        }
        if (a.getStatus() != AppointmentStatus.BOOKED) throw new ConflictException("Only BOOKED appointments can be completed (current: " + a.getStatus() + ")");
        if (a.startsAt().isAfter(LocalDateTime.now())) throw new BadRequestException("The appointment has not started yet");
        a.setStatus(AppointmentStatus.COMPLETED);
        a.setNotes(notes);
        appointments.saveAndFlush(a);
        cache.appointment(a.getId());
        events.publish(Topics.APPOINTMENT_COMPLETED, String.valueOf(a.getId()), new AppointmentCompletedEvent(EventPublisher.newId(), EventPublisher.now(),
                a.getId(), a.getPatientId(), a.getDoctorId(), a.getDoctorName(), a.getAppointmentDate(), notes));
        return AppointmentResponse.from(a);
    }

    // ---- reads --------------------------------------------------------------------------------------------

    @Cacheable(cacheNames = CacheEvictor.APPOINTMENTS, key = "#id")
    @Transactional(readOnly = true)
    public AppointmentResponse loadCached(Long id) {
        return AppointmentResponse.from(find(id));
    }

    /** Cached read + the access rule: staff see everything, a patient only their own appointments. */
    public AppointmentResponse get(Long id) {
        AppointmentResponse a = loadCached(id);
        if (CurrentUser.hasRole(Role.PATIENT) && !CurrentUser.isAdmin()) patients.requireAccess(a.getPatientId());
        return a;
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> forPatient(Long patientId) {
        patients.requireAccess(patientId);
        return appointments.findByPatientIdOrderByAppointmentDateDescStartTimeDesc(patientId).stream().map(AppointmentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> mine() {
        PatientSummary p = patients.byUser(CurrentUser.id());
        return appointments.findByPatientIdOrderByAppointmentDateDescStartTimeDesc(p.getId()).stream().map(AppointmentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> forDoctor(Long doctorId, LocalDate date) {
        List<Appointment> list = date == null ? appointments.findByDoctorIdOrderByAppointmentDateAscStartTimeAsc(doctorId)
                : appointments.findByDoctorIdAndAppointmentDateOrderByStartTime(doctorId, date);
        return list.stream().map(AppointmentResponse::from).toList();
    }

    // ---- event-driven updates (called by Kafka consumers) -------------------------------------------------

    @Transactional
    public void applyBilling(Long appointmentId, String billNumber, PaymentStatus status) {
        appointments.findById(appointmentId).ifPresentOrElse(a -> {
            a.setBillNumber(billNumber);
            if (a.getPaymentStatus() != PaymentStatus.PAID) a.setPaymentStatus(status);
            cache.appointment(a.getId());
        }, () -> log.warn("Billing event for unknown appointment {}", appointmentId));
    }

    // ---- helpers ------------------------------------------------------------------------------------------

    private SlotView resolveSlot(Long doctorId, LocalDate date, LocalTime start) {
        if (LocalDateTime.of(date, start).isBefore(LocalDateTime.now())) throw new BadRequestException("Cannot book a time in the past");
        // always read the live grid from the Doctor Service (not the cached availability view)
        return doctors.slots(doctorId, date).stream().filter(s -> s.getStartTime().equals(start)).findFirst()
                .orElseThrow(() -> new BadRequestException("The doctor does not offer a slot starting at " + start + " on " + date
                        + " (not a working day/hour, on a break, or on leave)"));
    }

    private void assertFree(Long doctorId, Long patientId, LocalDate date, SlotView slot, Long excludeId) {
        if (appointments.doctorBusy(doctorId, date, slot.getStartTime(), slot.getEndTime(), excludeId)) {
            throw new ConflictException("The doctor already has an appointment overlapping " + slot.getStartTime() + "-" + slot.getEndTime() + " on " + date);
        }
        if (appointments.patientBusy(patientId, date, slot.getStartTime(), slot.getEndTime(), excludeId)) {
            throw new ConflictException("The patient already has an overlapping appointment on " + date);
        }
    }

    /** Admin, the treating doctor, or the patient who owns the appointment. */
    private void authorizeParticipant(Appointment a) {
        if (CurrentUser.isAdmin()) return;
        if (CurrentUser.hasRole(Role.PATIENT)) {
            patients.requireAccess(a.getPatientId());
            return;
        }
        if (CurrentUser.hasRole(Role.DOCTOR)) {
            DoctorView d = doctors.doctor(a.getDoctorId());
            if (d.getUserId() != null && d.getUserId().equals(CurrentUser.id())) return;
        }
        throw new ForbiddenOperationException("You are not a participant of this appointment");
    }

    private Appointment find(Long id) {
        return appointments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Appointment " + id + " not found"));
    }

}
