package com.example.enrollment.repository;

import com.example.enrollment.entity.OutboxEvent;
import com.example.enrollment.entity.OutboxStatus;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    /** SELECT ... FOR UPDATE SKIP LOCKED (lock.timeout = -2): several service instances can poll without publishing twice. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("select e from OutboxEvent e where e.status = :status and e.nextAttemptAt <= :now order by e.outboxId")
    List<OutboxEvent> lockDue(@Param("status") OutboxStatus status, @Param("now") LocalDateTime now, Pageable pageable);

    long countByStatus(OutboxStatus status);
}
