package com.hrportal.organization.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.organization.entity.Organization;

public interface OrganizationRepository extends JpaRepository<Organization, String> {
}
