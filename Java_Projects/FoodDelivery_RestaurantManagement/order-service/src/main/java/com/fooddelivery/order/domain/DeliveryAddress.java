package com.fooddelivery.order.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Address snapshot copied at order time (later edits to the customer's address book must not change a past order). */
@Embeddable
@Getter @Setter @NoArgsConstructor
public class DeliveryAddress {
    @Column(name = "delivery_label", length = 40) private String label;
    @Column(name = "delivery_line1", nullable = false, length = 200) private String line1;
    @Column(name = "delivery_line2", length = 200) private String line2;
    @Column(name = "delivery_city", nullable = false, length = 80) private String city;
    @Column(name = "delivery_postal_code", length = 12) private String postalCode;
    @Column(name = "delivery_lat") private Double latitude;
    @Column(name = "delivery_lng") private Double longitude;

    public String oneLine() { return line1 + (line2 == null || line2.isBlank() ? "" : ", " + line2) + ", " + city + (postalCode == null ? "" : " " + postalCode); }
}
