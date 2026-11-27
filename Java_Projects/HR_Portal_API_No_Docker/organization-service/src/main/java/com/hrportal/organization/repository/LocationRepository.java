package com.hrportal.organization.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.organization.entity.Location;

public interface LocationRepository extends JpaRepository<Location, String> {
}
