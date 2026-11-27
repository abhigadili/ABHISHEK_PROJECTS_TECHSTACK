package com.hospital.doctor.domain;

import java.time.DayOfWeek;
import java.time.LocalTime;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One working day of the weekly template: hours, slot length and an optional break. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "doctor_schedules", uniqueConstraints = @UniqueConstraint(name = "uk_schedule_doctor_day", columnNames = {"doctor_id", "dayOfWeek"}))
public class DoctorSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false, foreignKey = @ForeignKey(name = "fk_schedule_doctor"))
    private Doctor doctor;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DayOfWeek dayOfWeek;
    @Column(nullable = false)
    private LocalTime startTime;
    @Column(nullable = false)
    private LocalTime endTime;
    @Column(nullable = false)
    private int slotMinutes;
    private LocalTime breakStart;
    private LocalTime breakEnd;
}
