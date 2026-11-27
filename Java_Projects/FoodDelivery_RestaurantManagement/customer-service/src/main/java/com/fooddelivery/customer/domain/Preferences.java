package com.fooddelivery.customer.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

/** Embeddable value object: columns live in the customers table. */
@Embeddable
@Getter @Setter
public class Preferences {
    @Column(length = 255)
    private String favouriteCuisines;       // comma separated
    private boolean vegetarianOnly;
    private boolean notifyEmail = true;
    private boolean notifySms = true;
    private boolean notifyInApp = true;
}
