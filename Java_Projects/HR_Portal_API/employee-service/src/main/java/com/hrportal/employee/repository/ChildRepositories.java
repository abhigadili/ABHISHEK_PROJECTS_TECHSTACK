package com.hrportal.employee.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.hrportal.employee.entity.EmployeeBankDetail;
import com.hrportal.employee.entity.EmployeeEducation;
import com.hrportal.employee.entity.EmployeeExperience;
import com.hrportal.employee.entity.EmployeeSequence;
import com.hrportal.employee.entity.EmployeeStatusHistory;
import com.hrportal.employee.entity.EmploymentHistory;
import com.hrportal.employee.entity.ProfileChangeLog;

import jakarta.persistence.LockModeType;

public final class ChildRepositories {
    private ChildRepositories() {
    }

    public interface EducationRepository extends JpaRepository<EmployeeEducation, String> {
        List<EmployeeEducation> findByEmployee_IdOrderByEndYearDesc(String employeeId);

        Optional<EmployeeEducation> findByIdAndEmployee_Id(String id, String employeeId);
    }

    public interface ExperienceRepository extends JpaRepository<EmployeeExperience, String> {
        List<EmployeeExperience> findByEmployeeIdOrderByStartDateDesc(String employeeId);

        Optional<EmployeeExperience> findByIdAndEmployeeId(String id, String employeeId);
    }

    public interface BankDetailRepository extends JpaRepository<EmployeeBankDetail, String> {
        Optional<EmployeeBankDetail> findByEmployee_Id(String employeeId);
    }

    public interface EmploymentHistoryRepository extends JpaRepository<EmploymentHistory, String> {
        List<EmploymentHistory> findByEmployeeIdOrderByEffectiveDateDescCreatedAtDesc(String employeeId);
    }

    public interface ProfileChangeLogRepository extends JpaRepository<ProfileChangeLog, String> {
        Page<ProfileChangeLog> findByEmployeeId(String employeeId, Pageable pageable);
    }

    public interface StatusHistoryRepository extends JpaRepository<EmployeeStatusHistory, Long> {
        List<EmployeeStatusHistory> findByEmployeeIdOrderByChangedAtDesc(String employeeId);
    }

    public interface SequenceRepository extends JpaRepository<EmployeeSequence, Integer> {
        /** PESSIMISTIC_WRITE = SELECT ... FOR UPDATE: concurrent onboardings queue up on this row. */
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("select s from EmployeeSequence s where s.id = 1")
        Optional<EmployeeSequence> lockCounter();
    }
}
