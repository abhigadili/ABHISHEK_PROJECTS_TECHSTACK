package com.hrportal.organization.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.organization.entity.Designation;

public interface DesignationRepository extends JpaRepository<Designation, String> {
}
