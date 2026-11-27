package com.hrportal.common.persistence;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

/**
 * Soft deletion: rows are flagged, never physically removed. Concrete entities add
 * {@code @SQLRestriction("deleted = false")} so normal queries never see deleted rows.
 */
@Getter
@Setter
@MappedSuperclass
public abstract class SoftDeletableEntity extends BaseEntity {
    @Column(nullable = false)
    private boolean deleted;
    private Instant deletedAt;

    public void markDeleted() {
        this.deleted = true;
        this.deletedAt = Instant.now();
    }
}
