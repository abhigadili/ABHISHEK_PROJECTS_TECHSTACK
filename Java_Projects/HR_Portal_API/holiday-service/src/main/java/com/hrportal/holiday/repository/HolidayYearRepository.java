package com.hrportal.holiday.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.holiday.entity.HolidayYear;

public interface HolidayYearRepository extends JpaRepository<HolidayYear, String> {
    Optional<HolidayYear> findByYearNumber(int yearNumber);
}
