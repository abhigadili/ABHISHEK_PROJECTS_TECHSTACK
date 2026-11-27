package com.hrportal.holiday.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class HolidayDtos {
    private HolidayDtos() {
    }

    public record ScopeDto(@NotBlank @Pattern(regexp = "LOCATION|DEPARTMENT") String scopeType, @NotBlank @Size(max = 36) String scopeId) { }

    public record HolidayRequest(@NotBlank @Size(max = 150) String name, @NotNull LocalDate holidayDate,
                                 @Pattern(regexp = "MANDATORY|OPTIONAL|RESTRICTED", message = "type must be MANDATORY, OPTIONAL or RESTRICTED") String type,
                                 @Size(max = 300) String description, @Valid List<ScopeDto> scopes) { }

    public record HolidayResponse(String id, String name, LocalDate holidayDate, int holidayYear, String type,
                                  String description, List<ScopeDto> scopes) { }

    public record HolidayYearRequest(@NotNull @Min(2000) @Max(2100) Integer yearNumber, @NotNull LocalDate startDate,
                                     @NotNull LocalDate endDate, Boolean active, @Size(max = 200) String description) { }

    public record HolidayYearResponse(String id, int yearNumber, LocalDate startDate, LocalDate endDate, boolean active, String description) { }

    /** Calendar of a year grouped by month name (January..December, in order). */
    public record HolidayCalendar(int year, int totalHolidays, Map<String, List<HolidayResponse>> months) { }
}
