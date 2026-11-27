package com.hospital.appointment.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.appointment.domain.Appointment;
import com.hospital.appointment.domain.AppointmentRepository;
import com.hospital.appointment.domain.AppointmentStatus;
import com.hospital.common.events.NotificationRequestedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.EventPublisher;

import lombok.extern.log4j.Log4j2;

/** Spring Scheduler jobs; intervals and the reminder lead time come from configuration, never hard-coded. */
@Log4j2
@Component
public class AppointmentJobs {
    private final AppointmentRepository appointments;
    private final EventPublisher events;
    private final CacheEvictor cache;
    private final long leadHours;

    public AppointmentJobs(AppointmentRepository appointments, EventPublisher events, CacheEvictor cache,
                           @Value("${hospital.scheduler.reminder.lead-hours:24}") long leadHours) {
        this.appointments = appointments;
        this.events = events;
        this.cache = cache;
        this.leadHours = leadHours;
    }

    /** Finds BOOKED appointments starting within the lead window and asks the Notification Service (via Kafka) to remind patient and doctor. */
    @Scheduled(fixedDelayString = "${hospital.scheduler.reminder.fixed-delay-ms:60000}", initialDelayString = "${hospital.scheduler.initial-delay-ms:30000}")
    @Transactional
    public void sendReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime limit = now.plus(Duration.ofHours(leadHours));
        int sent = 0;
        for (Appointment a : appointments.findByStatusAndReminderSentFalseAndAppointmentDateBetween(AppointmentStatus.BOOKED, now.toLocalDate(), limit.toLocalDate())) {
            if (a.startsAt().isBefore(now) || a.startsAt().isAfter(limit)) continue;
            String when = a.getAppointmentDate() + " " + a.getStartTime();
            if (a.getPatientEmail() != null) {
                events.publish(Topics.NOTIFICATION_REQUESTED, "appt-reminder-" + a.getId(), new NotificationRequestedEvent(EventPublisher.newId(), EventPublisher.now(),
                        a.getPatientEmail(), null, "EMAIL", "Appointment reminder",
                        "Reminder: you have an appointment with " + a.getDoctorName() + " on " + when + ".", "APPOINTMENT_REMINDER", String.valueOf(a.getId())));
            }
            if (a.getDoctorEmail() != null) {
                events.publish(Topics.NOTIFICATION_REQUESTED, "appt-reminder-" + a.getId(), new NotificationRequestedEvent(EventPublisher.newId(), EventPublisher.now(),
                        a.getDoctorEmail(), null, "EMAIL", "Upcoming appointment",
                        "Reminder: appointment with patient " + a.getPatientName() + " on " + when + ".", "APPOINTMENT_REMINDER", String.valueOf(a.getId())));
            }
            a.setReminderSent(true);
            sent++;
        }
        if (sent > 0) log.info("Appointment reminder job: {} reminder(s) queued", sent);
    }

    /** BOOKED appointments whose end time is long past were never attended - mark them MISSED and free the slot key. */
    @Scheduled(fixedDelayString = "${hospital.scheduler.missed.fixed-delay-ms:300000}", initialDelayString = "${hospital.scheduler.initial-delay-ms:30000}")
    @Transactional
    public void markMissed() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(2);
        int n = 0;
        for (Appointment a : appointments.findByStatusAndAppointmentDateLessThanEqual(AppointmentStatus.BOOKED, LocalDate.now())) {
            if (a.endsAt().isBefore(cutoff)) {
                a.setStatus(AppointmentStatus.MISSED);
                a.setSlotKey(null);
                cache.appointment(a.getId());
                cache.availability(a.getDoctorId(), a.getAppointmentDate());
                n++;
            }
        }
        if (n > 0) log.info("Missed-appointment job: {} appointment(s) marked MISSED", n);
    }
}
