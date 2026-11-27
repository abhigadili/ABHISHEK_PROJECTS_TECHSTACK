package com.hrportal.exit.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Access to be revoked (e-mail, VPN, source control, HR portal). */
@Getter
@Setter
@Entity
@DiscriminatorValue("ACCESS")
@NoArgsConstructor
public class AccessRevocationTask extends ExitTask {
    @Column(name = "system_name", length = 80)
    private String systemName;
    private LocalDate revokedOn;

    @Override
    public String kind() {
        return "ACCESS";
    }
}
