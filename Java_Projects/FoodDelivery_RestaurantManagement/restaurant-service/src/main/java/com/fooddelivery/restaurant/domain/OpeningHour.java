package com.fooddelivery.restaurant.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Entity
@Table(name = "opening_hours", uniqueConstraints = @UniqueConstraint(name = "uk_hours_day", columnNames = {"restaurant_id", "dayOfWeek"}))
@Getter @Setter @NoArgsConstructor
public class OpeningHour {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "restaurant_id")
    private Restaurant restaurant;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    private DayOfWeek dayOfWeek;
    private LocalTime opensAt;
    private LocalTime closesAt;
    @Column(nullable = false) private boolean closed;

    public boolean coversNow(LocalTime now) {
        if (closed || opensAt == null || closesAt == null) return false;
        return closesAt.isAfter(opensAt) ? !now.isBefore(opensAt) && now.isBefore(closesAt)
                : !now.isBefore(opensAt) || now.isBefore(closesAt);       // overnight span, e.g. 18:00 - 02:00
    }
}
