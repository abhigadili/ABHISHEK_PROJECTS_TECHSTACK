package com.hrportal.employee.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.employee.dto.EmployeeDtos.TeamMember;
import com.hrportal.employee.entity.Employee;
import com.hrportal.employee.entity.Enums.EmployeeStatus;

public interface EmployeeRepository extends JpaRepository<Employee, String>, JpaSpecificationExecutor<Employee>, EmployeeRepositoryCustom {

    Optional<Employee> findByWorkEmailIgnoreCase(String email);

    boolean existsByWorkEmailIgnoreCase(String email);

    /** Entity graphs: load exactly the collection that is needed, in one SELECT (no N+1, no accidental cartesian product). */
    @EntityGraph(attributePaths = "addresses")
    Optional<Employee> findWithAddressesById(String id);

    @EntityGraph(attributePaths = "emergencyContacts")
    Optional<Employee> findWithEmergencyContactsById(String id);

    /** DTO query: JPQL constructor expression, selects 6 columns instead of whole entities. */
    @Query("select new com.hrportal.employee.dto.EmployeeDtos$TeamMember(e.id, e.employeeCode, e.firstName, e.lastName, e.workEmail, e.designationId, e.status) "
            + "from Employee e where e.managerId = :managerId and e.status <> :excluded order by e.firstName, e.lastName")
    List<TeamMember> findTeam(@Param("managerId") String managerId, @Param("excluded") EmployeeStatus excluded);

    /** Projection query used by the directory (JPQL with bound parameters; the search text is bound, never concatenated). */
    @Query("select e.id as id, e.employeeCode as employeeCode, e.firstName as firstName, e.lastName as lastName, e.workEmail as workEmail, "
            + "e.departmentId as departmentId, e.designationId as designationId, e.locationId as locationId, e.status as status "
            + "from Employee e where e.status in :statuses and (:q is null or lower(e.firstName) like :q or lower(e.lastName) like :q "
            + "or lower(e.workEmail) like :q or lower(e.employeeCode) like :q)")
    Page<DirectoryView> directory(@Param("statuses") Collection<EmployeeStatus> statuses, @Param("q") String likeQuery, Pageable pageable);

    /** Native SQL (MySQL): simple aggregate that does not need the entity model. */
    @Query(value = "SELECT status, COUNT(*) FROM employees WHERE deleted = 0 GROUP BY status", nativeQuery = true)
    List<Object[]> countByStatusNative();

    List<Employee> findByIdIn(Collection<String> ids);

    @Query("select e from Employee e where e.joiningDate = :date and e.status = com.hrportal.employee.entity.Enums$EmployeeStatus.ACTIVE")
    List<Employee> findJoinedOn(@Param("date") java.time.LocalDate date);
}
