package com.hrportal.exit.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.exit.entity.Enums.ResignationStatus;
import com.hrportal.exit.entity.ExitHistory;
import com.hrportal.exit.entity.ExitInterview;
import com.hrportal.exit.entity.ExitPolicy;
import com.hrportal.exit.entity.ExitTask;
import com.hrportal.exit.entity.InterviewForm;
import com.hrportal.exit.entity.Resignation;
import com.hrportal.exit.entity.Settlement;
import com.hrportal.exit.entity.SettlementLine;

public final class ExitRepositories {
    private ExitRepositories() {
    }

    public interface PolicyRepository extends JpaRepository<ExitPolicy, String> {
    }

    public interface ResignationRepository extends JpaRepository<Resignation, String> {
        List<Resignation> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

        boolean existsByEmployeeIdAndStatusNotIn(String employeeId, Collection<ResignationStatus> finished);

        Page<Resignation> findByStatus(ResignationStatus status, Pageable pageable);

        List<Resignation> findByManagerIdAndStatus(String managerId, ResignationStatus status);

        @Query("select r from Resignation r where r.status not in (com.hrportal.exit.entity.Enums$ResignationStatus.COMPLETED, com.hrportal.exit.entity.Enums$ResignationStatus.WITHDRAWN, "
                + "com.hrportal.exit.entity.Enums$ResignationStatus.MANAGER_REJECTED) order by r.submittedOn")
        List<Resignation> findOpen();
    }

    public interface TaskRepository extends JpaRepository<ExitTask, String> {
        /** Polymorphic query: returns ChecklistTask, ClearanceTask, KnowledgeTransferTask ... instances from the single table. */
        List<ExitTask> findByResignationIdOrderByCreatedAtAsc(String resignationId);

        long countByResignationIdAndStatus(String resignationId, com.hrportal.exit.entity.Enums.TaskStatus status);
    }

    public interface FormRepository extends JpaRepository<InterviewForm, String> {
        Optional<InterviewForm> findFirstByActiveTrueOrderByCreatedAtDesc();
    }

    public interface InterviewRepository extends JpaRepository<ExitInterview, String> {
        Optional<ExitInterview> findByResignationId(String resignationId);
    }

    public interface SettlementRepository extends JpaRepository<Settlement, String> {
        Optional<Settlement> findByResignationId(String resignationId);
    }

    public interface SettlementLineRepository extends JpaRepository<SettlementLine, String> {
        List<SettlementLine> findBySettlementIdOrderByTypeAscCodeAsc(String settlementId);

        @org.springframework.data.jpa.repository.Modifying
        @Query("delete from SettlementLine l where l.settlementId = :settlementId")
        int deleteBySettlementId(@Param("settlementId") String settlementId);
    }

    public interface HistoryRepository extends JpaRepository<ExitHistory, String> {
        List<ExitHistory> findByResignationIdOrderByCreatedAtAsc(String resignationId);
    }
}
