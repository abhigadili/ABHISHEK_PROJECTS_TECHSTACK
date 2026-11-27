package com.hrportal.holiday.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.holiday.entity.Holiday;

public interface HolidayRepository extends JpaRepository<Holiday, String> {

    /** The entity graph loads the scopes collection in the same query: no lazy-loading N+1 when mapping a list. */
    @EntityGraph(attributePaths = "scopes")
    List<Holiday> findByHolidayDateBetweenOrderByHolidayDate(LocalDate from, LocalDate to);

    @EntityGraph(attributePaths = "scopes")
    List<Holiday> findByHolidayYearOrderByHolidayDate(int year);

    boolean existsByHolidayDateAndNameIgnoreCase(LocalDate date, String name);
}
