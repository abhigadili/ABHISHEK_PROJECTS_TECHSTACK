package com.hrportal.organization.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.organization.entity.Department;

public interface DepartmentRepository extends JpaRepository<Department, String> {
}
