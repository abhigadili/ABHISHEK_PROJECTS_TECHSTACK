package com.example.course.repository;

import com.example.course.entity.SeatReservation;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeatReservationRepository extends JpaRepository<SeatReservation, Long> {
    Optional<SeatReservation> findByEnrollmentId(Long enrollmentId);
}
