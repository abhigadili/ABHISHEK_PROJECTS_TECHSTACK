package com.example.course.service;

import com.example.common.exception.ConflictException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.course.config.CourseCacheEvictor;
import com.example.course.dto.SeatDtos.SeatResponse;
import com.example.course.entity.Course;
import com.example.course.entity.CourseStatus;
import com.example.course.entity.ReservationStatus;
import com.example.course.entity.SeatReservation;
import com.example.course.repository.CourseRepository;
import com.example.course.repository.SeatReservationRepository;
import com.example.course.service.LowAvailabilityPublisher.LowAvailabilityDetected;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seat reservation / release. Overselling is prevented by an atomic conditional UPDATE (see CourseRepository);
 * idempotency per enrollmentId is provided by the unique sms_seat_reservations.enrollment_id row.
 */
@Service
public class SeatService {
    private static final Logger log = LoggerFactory.getLogger(SeatService.class);

    private final CourseRepository courses;
    private final SeatReservationRepository reservations;
    private final CourseCacheEvictor evictor;
    private final ApplicationEventPublisher events;
    private final int lowThreshold;

    public SeatService(CourseRepository courses, SeatReservationRepository reservations, CourseCacheEvictor evictor,
                       ApplicationEventPublisher events, @Value("${app.course.low-availability-threshold:5}") int lowThreshold) {
        this.courses = courses; this.reservations = reservations; this.evictor = evictor; this.events = events; this.lowThreshold = lowThreshold;
    }

    @Transactional
    public SeatResponse reserve(Long courseId, Long enrollmentId) {
        Course course = courses.findById(courseId).orElseThrow(() -> new ResourceNotFoundException("Course " + courseId + " not found"));
        Optional<SeatReservation> existing = reservations.findByEnrollmentId(enrollmentId);
        if (existing.isPresent()) {
            SeatReservation r = existing.get();
            if (!r.getCourseId().equals(courseId)) throw new ConflictException("Enrollment " + enrollmentId + " reserved a seat in another course");
            if (r.getStatus() == ReservationStatus.RELEASED) throw new ConflictException("Reservation for enrollment " + enrollmentId + " was already released");
            return new SeatResponse(courseId, enrollmentId, "RESERVED", course.getAvailableSeats(), true); // idempotent replay
        }
        if (courses.reserveSeat(courseId, CourseStatus.ACTIVE) == 0) {
            throw new ConflictException(course.getStatus() != CourseStatus.ACTIVE
                    ? "Course " + courseId + " is not active" : "No seats available in course " + courseId);
        }
        SeatReservation r = new SeatReservation();
        r.setEnrollmentId(enrollmentId);
        r.setCourseId(courseId);
        r.setStatus(ReservationStatus.RESERVED);
        reservations.saveAndFlush(r);

        Course fresh = courses.findById(courseId).orElseThrow();
        evictor.evictAfterCommit(courseId);
        if (fresh.getAvailableSeats() <= lowThreshold) {
            events.publishEvent(new LowAvailabilityDetected(courseId, fresh.getCourseCode(), fresh.getCourseName(),
                    fresh.getAvailableSeats(), fresh.getTotalSeats()));
        }
        log.info("Reserved seat course={} enrollment={} remaining={}", courseId, enrollmentId, fresh.getAvailableSeats());
        return new SeatResponse(courseId, enrollmentId, "RESERVED", fresh.getAvailableSeats(), false);
    }

    /** Idempotent: releasing an unknown or already-released reservation is a successful no-op. */
    @Transactional
    public SeatResponse release(Long courseId, Long enrollmentId) {
        Course course = courses.findById(courseId).orElseThrow(() -> new ResourceNotFoundException("Course " + courseId + " not found"));
        Optional<SeatReservation> existing = reservations.findByEnrollmentId(enrollmentId);
        if (existing.isEmpty() || existing.get().getStatus() == ReservationStatus.RELEASED) {
            return new SeatResponse(courseId, enrollmentId, "RELEASED", course.getAvailableSeats(), true);
        }
        SeatReservation r = existing.get();
        if (!r.getCourseId().equals(courseId)) throw new ConflictException("Enrollment " + enrollmentId + " reserved a seat in another course");
        courses.releaseSeat(courseId);
        r.setStatus(ReservationStatus.RELEASED);
        reservations.saveAndFlush(r);
        Course fresh = courses.findById(courseId).orElseThrow();
        evictor.evictAfterCommit(courseId);
        log.info("Released seat course={} enrollment={} available={}", courseId, enrollmentId, fresh.getAvailableSeats());
        return new SeatResponse(courseId, enrollmentId, "RELEASED", fresh.getAvailableSeats(), false);
    }
}
