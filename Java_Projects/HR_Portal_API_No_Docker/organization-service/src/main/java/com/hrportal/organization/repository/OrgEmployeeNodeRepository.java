package com.hrportal.organization.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.organization.entity.OrgEmployeeNode;

public interface OrgEmployeeNodeRepository extends JpaRepository<OrgEmployeeNode, String> {
    Page<OrgEmployeeNode> findByDepartmentId(String departmentId, Pageable pageable);

    List<OrgEmployeeNode> findByManagerId(String managerId);

    List<OrgEmployeeNode> findByStatusNot(String status);

    long countByDepartmentId(String departmentId);
}
