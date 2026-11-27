package com.hospital.appointment.domain;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    /** Any BOOKED appointment of the doctor overlapping [start, end) on that date (excluding one id when rescheduling). */
    @Query("""
            select count(a) > 0 from Appointment a
            where a.doctorId = :doctorId and a.appointmentDate = :date and a.status = 'BOOKED'
              and a.startTime < :end and a.endTime > :start and (:excludeId is null or a.id <> :excludeId)
            """)
    boolean doctorBusy(@Param("doctorId") Long doctorId, @Param("date") LocalDate date, @Param("start") LocalTime start,
                       @Param("end") LocalTime end, @Param("excludeId") Long excludeId);

    @Query("""
            select count(a) > 0 from Appointment a
            where a.patientId = :patientId and a.appointmentDate = :date and a.status = 'BOOKED'
              and a.startTime < :end and a.endTime > :start and (:excludeId is null or a.id <> :excludeId)
            """)
    boolean patientBusy(@Param("patientId") Long patientId, @Param("date") LocalDate date, @Param("start") LocalTime start,
                        @Param("end") LocalTime end, @Param("excludeId") Long excludeId);

    List<Appointment> findByDoctorIdAndAppointmentDateAndStatus(Long doctorId, LocalDate date, AppointmentStatus status);

    List<Appointment> findByPatientIdOrderByAppointmentDateDescStartTimeDesc(Long patientId);

    List<Appointment> findByDoctorIdOrderByAppointmentDateAscStartTimeAsc(Long doctorId);

    List<Appointment> findByDoctorIdAndAppointmentDateOrderByStartTime(Long doctorId, LocalDate date);

    List<Appointment> findByStatusAndReminderSentFalseAndAppointmentDateBetween(AppointmentStatus status, LocalDate from, LocalDate to);

    List<Appointment> findByStatusAndAppointmentDateLessThanEqual(AppointmentStatus status, LocalDate date);
}
