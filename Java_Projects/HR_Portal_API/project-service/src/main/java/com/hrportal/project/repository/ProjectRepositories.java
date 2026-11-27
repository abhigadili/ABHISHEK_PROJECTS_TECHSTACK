package com.hrportal.project.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.project.entity.Customer;
import com.hrportal.project.entity.CustomerContact;
import com.hrportal.project.entity.Enums.AllocationStatus;
import com.hrportal.project.entity.Project;
import com.hrportal.project.entity.ProjectAllocation;
import com.hrportal.project.entity.ProjectHistory;

public final class ProjectRepositories {
    private ProjectRepositories() {
    }

    public interface CustomerRepository extends JpaRepository<Customer, String> {
        boolean existsByCodeIgnoreCase(String code);

        @Query("select c from Customer c where :q is null or lower(c.name) like :q or lower(c.code) like :q")
        Page<Customer> search(@Param("q") String likeQuery, Pageable pageable);
    }

    public interface ContactRepository extends JpaRepository<CustomerContact, String> {
        List<CustomerContact> findByCustomerIdOrderByNameAsc(String customerId);
    }

    public interface ProjectRepository extends JpaRepository<Project, String>, JpaSpecificationExecutor<Project> {
        boolean existsByCodeIgnoreCase(String code);

        boolean existsByCustomerIdAndStatusIn(String customerId, Collection<com.hrportal.project.entity.Enums.ProjectStatus> statuses);

        List<Project> findByIdIn(Collection<String> ids);

        List<Project> findByProjectManagerId(String projectManagerId);
    }

    public interface AllocationRepository extends JpaRepository<ProjectAllocation, String> {
        List<ProjectAllocation> findByProjectIdOrderByStartDateDesc(String projectId);

        List<ProjectAllocation> findByProjectIdAndStatus(String projectId, AllocationStatus status);

        /** All live allocations of an employee that overlap [from, to] (open end date = still running). */
        @Query("select a from ProjectAllocation a where a.employeeId = :employeeId and a.status = com.hrportal.project.entity.Enums$AllocationStatus.ACTIVE "
                + "and a.startDate <= :to and (a.endDate is null or a.endDate >= :from) and (:excludeId is null or a.id <> :excludeId)")
        List<ProjectAllocation> findOverlapping(@Param("employeeId") String employeeId, @Param("from") LocalDate from, @Param("to") LocalDate to,
                                                @Param("excludeId") String excludeId);

        @Query("select a from ProjectAllocation a where a.employeeId = :employeeId and a.status = com.hrportal.project.entity.Enums$AllocationStatus.ACTIVE "
                + "and a.projectId = :projectId and a.startDate <= :date and (a.endDate is null or a.endDate >= :date)")
        Optional<ProjectAllocation> findActiveOn(@Param("employeeId") String employeeId, @Param("projectId") String projectId, @Param("date") LocalDate date);

        List<ProjectAllocation> findByEmployeeIdOrderByStartDateDesc(String employeeId);

        List<ProjectAllocation> findByEmployeeIdAndStatus(String employeeId, AllocationStatus status);
    }

    public interface HistoryRepository extends JpaRepository<ProjectHistory, String> {
        List<ProjectHistory> findByProjectIdOrderByCreatedAtDesc(String projectId);
    }
}
