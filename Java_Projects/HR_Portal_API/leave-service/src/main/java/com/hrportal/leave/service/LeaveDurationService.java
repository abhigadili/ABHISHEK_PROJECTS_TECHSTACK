package com.hrportal.leave.service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Leave duration is computed by the MySQL function fn_leave_duration (weekends excluded, half days applied); Java only
 * supplies the number of holiday weekdays inside the range. JdbcTemplate.queryForObject with bound parameters.
 */
@Service
public class LeaveDurationService {
    private final JdbcTemplate jdbc;

    public LeaveDurationService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public BigDecimal duration(LocalDate from, LocalDate to, boolean halfStart, boolean halfEnd, Set<LocalDate> holidays) {
        long holidayWeekdays = holidays.stream().filter(d -> !d.isBefore(from) && !d.isAfter(to))
                .filter(d -> d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY).count();
        return jdbc.queryForObject("SELECT fn_leave_duration(?, ?, ?, ?, ?)", BigDecimal.class,
                java.sql.Date.valueOf(from), java.sql.Date.valueOf(to), halfStart ? 1 : 0, halfEnd ? 1 : 0, (int) holidayWeekdays);
    }
}
