package com.hrportal.holiday.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Embeddable value object: a holiday with no scopes applies to everyone, otherwise only to the listed locations / departments. */
@Getter
@Setter
@NoArgsConstructor
@Embeddable
public class HolidayScope {
    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false, length = 20)
    private ScopeType scopeType;
    @Column(name = "scope_id", nullable = false, length = 36)
    private String scopeId;
}
