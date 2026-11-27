package com.hrportal.common.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditHistoryRepository extends JpaRepository<AuditHistory, String> {

    @Query("select a from AuditHistory a where (:type is null or a.entityType = :type) "
            + "and (:entityId is null or a.entityId = :entityId) and (:action is null or a.action = :action)")
    Page<AuditHistory> search(@Param("type") String type, @Param("entityId") String entityId,
                              @Param("action") String action, Pageable pageable);
}
