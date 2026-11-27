package com.hospital.doctor.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.doctor.domain.Doctor;
import com.hospital.doctor.domain.DoctorRepository;
import com.hospital.doctor.domain.DoctorSchedule;
import com.hospital.doctor.domain.DoctorScheduleRepository;
import com.hospital.doctor.domain.DoctorUnavailabilityRepository;
import com.hospital.doctor.dto.DoctorDtos.SlotDto;
import com.hospital.common.web.ResourceNotFoundException;

/** Generates the bookable slot grid of a doctor for a date. Cached in Redis; schedule/leave changes evict it. */
@Service
public class SlotService {
    private final DoctorRepository doctors;
    private final DoctorScheduleRepository schedules;
    private final DoctorUnavailabilityRepository unavailability;

    public SlotService(DoctorRepository doctors, DoctorScheduleRepository schedules, DoctorUnavailabilityRepository unavailability) {
        this.doctors = doctors;
        this.schedules = schedules;
        this.unavailability = unavailability;
    }

    @Cacheable(cacheNames = "doctorSlots", key = "#doctorId + ':' + #date")
    @Transactional(readOnly = true)
    public List<SlotDto> slots(Long doctorId, LocalDate date) {
        Doctor d = doctors.findById(doctorId).orElseThrow(() -> new ResourceNotFoundException("Doctor " + doctorId + " not found"));
        List<SlotDto> out = new ArrayList<>();
        if (!d.isActive() || unavailability.existsByDoctorIdAndUnavailableDate(doctorId, date)) return out;
        DoctorSchedule s = schedules.findByDoctorIdAndDayOfWeek(doctorId, date.getDayOfWeek()).orElse(null);
        if (s == null) return out;
        LocalTime start = s.getStartTime();
        while (!start.plusMinutes(s.getSlotMinutes()).isAfter(s.getEndTime())) {
            LocalTime end = start.plusMinutes(s.getSlotMinutes());
            boolean overlapsBreak = s.getBreakStart() != null && s.getBreakEnd() != null
                    && start.isBefore(s.getBreakEnd()) && end.isAfter(s.getBreakStart());
            if (!overlapsBreak) out.add(new SlotDto(start, end, true));
            // a slot that ends exactly at midnight would wrap around - stop there
            if (end.isBefore(start)) break;
            start = end;
            if (start.equals(LocalTime.MIDNIGHT)) break;
        }
        return out;
    }
}
