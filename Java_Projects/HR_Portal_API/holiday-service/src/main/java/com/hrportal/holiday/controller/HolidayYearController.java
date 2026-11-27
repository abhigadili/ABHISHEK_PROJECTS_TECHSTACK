package com.hrportal.holiday.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.holiday.dto.HolidayDtos.HolidayYearRequest;
import com.hrportal.holiday.dto.HolidayDtos.HolidayYearResponse;
import com.hrportal.holiday.service.HolidayYearService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Holiday Years")
@RestController
@RequestMapping("/api/v1/holidays/years")
public class HolidayYearController {
    private final HolidayYearService service;

    public HolidayYearController(HolidayYearService service) {
        this.service = service;
    }

    @GetMapping
    public List<HolidayYearResponse> list() {
        return service.all();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_HOLIDAY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public HolidayYearResponse create(@Valid @RequestBody HolidayYearRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_HOLIDAY_MANAGE')")
    public HolidayYearResponse update(@PathVariable String id, @Valid @RequestBody HolidayYearRequest req) {
        return service.update(id, req);
    }
}
