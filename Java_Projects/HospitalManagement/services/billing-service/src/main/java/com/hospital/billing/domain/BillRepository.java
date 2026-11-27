package com.hospital.billing.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BillRepository extends JpaRepository<Bill, Long> {
    @Query("select b from Bill b left join fetch b.items where b.id = :id")
    Optional<Bill> findWithItems(@Param("id") Long id);

    boolean existsByReferenceTypeAndReferenceId(String referenceType, Long referenceId);

    Optional<Bill> findByReferenceTypeAndReferenceId(String referenceType, Long referenceId);

    @Query("select distinct b from Bill b left join fetch b.items where b.patientId = :patientId order by b.createdAt desc")
    List<Bill> findByPatient(@Param("patientId") Long patientId);

    Page<Bill> findByStatus(BillStatus status, Pageable pageable);

    List<Bill> findByStatusAndDueDateBefore(BillStatus status, LocalDate date);

    @Query("select b from Bill b where b.status in :statuses and b.createdAt < :olderThan and (b.lastReminderAt is null or b.lastReminderAt < :remindedBefore)")
    List<Bill> findRemindable(@Param("statuses") List<BillStatus> statuses, @Param("olderThan") Instant olderThan, @Param("remindedBefore") Instant remindedBefore);
}
