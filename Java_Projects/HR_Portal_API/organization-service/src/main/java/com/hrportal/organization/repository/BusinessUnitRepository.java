package com.hrportal.organization.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.organization.entity.BusinessUnit;

public interface BusinessUnitRepository extends JpaRepository<BusinessUnit, String> {
}
