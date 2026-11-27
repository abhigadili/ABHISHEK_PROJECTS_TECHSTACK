package com.hrportal.leave.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.leave.entity.Enums.ApprovalStage;
import com.hrportal.leave.entity.Enums.LeaveStatus;
import com.hrportal.leave.entity.LeaveApplication;
import com.hrportal.leave.entity.LeaveApproval;
import com.hrportal.leave.entity.LeaveAttachment;
import com.hrportal.leave.entity.LeaveBalance;
import com.hrportal.leave.entity.LeaveBalanceHistory;
import com.hrportal.leave.entity.LeaveBalanceId;
import com.hrportal.leave.entity.LeaveComment;
import com.hrportal.leave.entity.LeaveEmployee;
import com.hrportal.leave.entity.LeavePolicy;
import com.hrportal.leave.entity.LeavePolicyEntitlement;
import com.hrportal.leave.entity.LeaveRunLog;
import com.hrportal.leave.entity.LeaveType;
import com.hrportal.leave.entity.PolicyEntitlementId;

import jakarta.persistence.LockModeType;

public final class LeaveRepositories {
    private LeaveRepositories() {
    }

    public interface LeaveTypeRepository extends JpaRepository<LeaveType, String> {
        Optional<LeaveType> findByCodeIgnoreCase(String code);

        List<LeaveType> findByActiveTrueOrderByName();
    }

    public interface LeavePolicyRepository extends JpaRepository<LeavePolicy, String> {
        Optional<LeavePolicy> findFirstByDefaultPolicyTrueAndActiveTrue();

        List<LeavePolicy> findAllByOrderByNameAsc();
    }

    public interface EntitlementRepository extends JpaRepository<LeavePolicyEntitlement, PolicyEntitlementId> {
        List<LeavePolicyEntitlement> findByPolicyId(String policyId);

        void deleteByPolicyId(String policyId);
    }

    public interface LeaveBalanceRepository extends JpaRepository<LeaveBalance, LeaveBalanceId> {
        @Query("select b from LeaveBalance b where b.id.employeeId = :employeeId and b.id.year = :year")
        List<LeaveBalance> findForEmployee(@Param("employeeId") String employeeId, @Param("year") int year);

        /** SELECT ... FOR UPDATE on the single balance row: concurrent applications for the same leave type serialise here. */
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("select b from LeaveBalance b where b.id = :id")
        Optional<LeaveBalance> lockById(@Param("id") LeaveBalanceId id);

        @Query("select b from LeaveBalance b where b.id.year = :year")
        List<LeaveBalance> findAllForYear(@Param("year") int year);
    }

    public interface BalanceHistoryRepository extends JpaRepository<LeaveBalanceHistory, Long> {
        Page<LeaveBalanceHistory> findByEmployeeIdAndBalanceYear(String employeeId, int balanceYear, Pageable pageable);
    }

    public interface LeaveApplicationRepository extends JpaRepository<LeaveApplication, String> {

        /** Overlap rule: two ranges overlap when each starts before the other ends. Only live applications count. */
        @Query("select count(a) > 0 from LeaveApplication a where a.employeeId = :employeeId and a.status in :statuses "
                + "and a.fromDate <= :toDate and a.toDate >= :fromDate and (:excludeId is null or a.id <> :excludeId)")
        boolean existsOverlap(@Param("employeeId") String employeeId, @Param("fromDate") LocalDate from, @Param("toDate") LocalDate to,
                              @Param("statuses") Collection<LeaveStatus> statuses, @Param("excludeId") String excludeId);

        Page<LeaveApplication> findByEmployeeId(String employeeId, Pageable pageable);

        Page<LeaveApplication> findByEmployeeIdAndStatus(String employeeId, LeaveStatus status, Pageable pageable);

        List<LeaveApplication> findByManagerIdAndStatusAndStageOrderByAppliedAtAsc(String managerId, LeaveStatus status, ApprovalStage stage);

        List<LeaveApplication> findByStatusAndStageOrderByAppliedAtAsc(LeaveStatus status, ApprovalStage stage);

        List<LeaveApplication> findByStatusAndCancelRequestedTrueOrderByAppliedAtAsc(LeaveStatus status);

        @Query("select a from LeaveApplication a where a.status = :status and a.fromDate <= :to and a.toDate >= :from "
                + "and (:employeeId is null or a.employeeId = :employeeId) order by a.fromDate")
        List<LeaveApplication> findInRange(@Param("status") LeaveStatus status, @Param("from") LocalDate from, @Param("to") LocalDate to,
                                           @Param("employeeId") String employeeId);

        @Query("select a from LeaveApplication a where a.status = :status and a.fromDate <= :to and a.toDate >= :from and a.employeeId in :ids order by a.fromDate")
        List<LeaveApplication> findInRangeForEmployees(@Param("status") LeaveStatus status, @Param("from") LocalDate from, @Param("to") LocalDate to,
                                                       @Param("ids") Collection<String> ids);
    }

    public interface ApprovalRepository extends JpaRepository<LeaveApproval, String> {
        List<LeaveApproval> findByApplicationIdOrderByCreatedAtAsc(String applicationId);
    }

    public interface CommentRepository extends JpaRepository<LeaveComment, String> {
        List<LeaveComment> findByApplicationIdOrderByCreatedAtAsc(String applicationId);
    }

    public interface AttachmentRepository extends JpaRepository<LeaveAttachment, String> {
        List<LeaveAttachment> findByApplicationId(String applicationId);

        List<LeaveAttachment> findByApplicationIdIn(Collection<String> applicationIds);
    }

    public interface LeaveEmployeeRepository extends JpaRepository<LeaveEmployee, String> {
        List<LeaveEmployee> findByStatusIn(Collection<String> statuses);

        List<LeaveEmployee> findByDepartmentId(String departmentId);
    }

    public interface RunLogRepository extends JpaRepository<LeaveRunLog, String> {
    }
}
