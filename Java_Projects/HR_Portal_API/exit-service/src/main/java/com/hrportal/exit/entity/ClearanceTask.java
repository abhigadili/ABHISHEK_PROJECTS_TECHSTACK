package com.hrportal.exit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Department clearance (MANAGER, IT, FINANCE, ADMIN, HR). */
@Getter
@Setter
@Entity
@DiscriminatorValue("CLEARANCE")
@NoArgsConstructor
public class ClearanceTask extends ExitTask {
    @Column(length = 20)
    private String department;

    @Override
    public String kind() {
        return "CLEARANCE";
    }
}
