package com.hrportal.holiday.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.holiday.dto.HolidayDtos.HolidayCalendar;
import com.hrportal.holiday.dto.HolidayDtos.HolidayRequest;
import com.hrportal.holiday.dto.HolidayDtos.HolidayResponse;
import com.hrportal.holiday.service.HolidayService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Holidays")
@RestController
@RequestMapping("/api/v1/holidays")
public class HolidayController {
    private final HolidayService service;

    public HolidayController(HolidayService service) {
        this.service = service;
    }

    @Operation(summary = "Holidays of a year, optionally for one location / department")
    @GetMapping
    public List<HolidayResponse> byYear(@RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year,
                                        @RequestParam(required = false) String locationId, @RequestParam(required = false) String departmentId) {
        return service.byYear(year, locationId, departmentId);
    }

    @Operation(summary = "Holidays inside a date range (used by the Attendance and Leave services)")
    @GetMapping("/range")
    public List<HolidayResponse> range(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                       @RequestParam(required = false) String locationId, @RequestParam(required = false) String departmentId) {
        return service.range(from, to, locationId, departmentId);
    }

    @GetMapping("/upcoming")
    public List<HolidayResponse> upcoming(@RequestParam(defaultValue = "5") int limit, @RequestParam(required = false) String locationId,
                                          @RequestParam(required = false) String departmentId) {
        return service.upcoming(limit, locationId, departmentId);
    }

    @Operation(summary = "Calendar of a year grouped by month")
    @GetMapping("/calendar/{year}")
    public HolidayCalendar calendar(@PathVariable int year, @RequestParam(required = false) String locationId,
                                    @RequestParam(required = false) String departmentId) {
        return service.calendar(year, locationId, departmentId);
    }

    @GetMapping("/{id}")
    public HolidayResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_HOLIDAY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public HolidayResponse create(@Valid @RequestBody HolidayRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_HOLIDAY_MANAGE')")
    public HolidayResponse update(@PathVariable String id, @Valid @RequestBody HolidayRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_HOLIDAY_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }
}
