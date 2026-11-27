package com.hospital.appointment.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Double-booking is prevented twice: by an overlap check in the service and by the unique "slotKey"
 * (doctor|date|start) that exists only while the appointment is BOOKED - cancelling sets it to NULL so the
 * slot can be booked again (MySQL allows many NULLs in a unique index).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "appointments",
        uniqueConstraints = @UniqueConstraint(name = "uk_appointment_slot", columnNames = "slotKey"),
        indexes = {@Index(name = "idx_appt_doctor_date", columnList = "doctorId,appointmentDate,status"),
                @Index(name = "idx_appt_patient", columnList = "patientId,appointmentDate"),
                @Index(name = "idx_appt_reminder", columnList = "status,reminderSent,appointmentDate")})
public class Appointment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long patientId;
    @Column(nullable = false)
    private Long doctorId;
    @Column(nullable = false)
    private LocalDate appointmentDate;
    @Column(nullable = false)
    private LocalTime startTime;
    @Column(nullable = false)
    private LocalTime endTime;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private AppointmentStatus status = AppointmentStatus.BOOKED;
    @Column(length = 80)
    private String slotKey;
    @Column(length = 255)
    private String reason;
    @Column(length = 255)
    private String cancelReason;
    @Column(length = 1000)
    private String notes;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal fee = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private PaymentStatus paymentStatus = PaymentStatus.NOT_BILLED;
    @Column(length = 40)
    private String billNumber;
    /** Snapshots taken at booking time so notifications never need a synchronous lookup. */
    @Column(nullable = false, length = 121)
    private String patientName;
    @Column(length = 120)
    private String patientEmail;
    @Column(nullable = false, length = 125)
    private String doctorName;
    @Column(length = 120)
    private String doctorEmail;
    @Column(nullable = false)
    private boolean reminderSent;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
    @Version
    private Long version;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public LocalDateTime startsAt() {
        return LocalDateTime.of(appointmentDate, startTime);
    }

    public LocalDateTime endsAt() {
        return LocalDateTime.of(appointmentDate, endTime);
    }

    public static String slotKey(Long doctorId, LocalDate date, LocalTime start) {
        return doctorId + "|" + date + "|" + start;
    }
}
