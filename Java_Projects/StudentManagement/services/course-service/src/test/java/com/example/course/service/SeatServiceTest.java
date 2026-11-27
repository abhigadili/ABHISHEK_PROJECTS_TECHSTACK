package com.example.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.example.common.exception.ConflictException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.course.config.CourseCacheEvictor;
import com.example.course.dto.SeatDtos.SeatResponse;
import com.example.course.entity.*;
import com.example.course.repository.CourseRepository;
import com.example.course.repository.SeatReservationRepository;
import com.example.course.service.LowAvailabilityPublisher.LowAvailabilityDetected;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class SeatServiceTest {
    @Mock CourseRepository courses;
    @Mock SeatReservationRepository reservations;
    @Mock CourseCacheEvictor evictor;
    @Mock ApplicationEventPublisher events;
    SeatService service;

    @BeforeEach
    void setUp() { service = new SeatService(courses, reservations, evictor, events, 5); }

    private static Course course(int available, CourseStatus status) {
        Course c = new Course();
        c.setCourseId(1L); c.setCourseCode("JMS-101"); c.setCourseName("Java"); c.setTotalSeats(10); c.setAvailableSeats(available); c.setStatus(status);
        return c;
    }

    private static SeatReservation reservation(ReservationStatus status, long courseId) {
        SeatReservation r = new SeatReservation();
        r.setEnrollmentId(100L); r.setCourseId(courseId); r.setStatus(status);
        return r;
    }

    @Test
    void reserveDecrementsAtomicallyStoresReservationAndEvictsCache() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(8, CourseStatus.ACTIVE)), Optional.of(course(7, CourseStatus.ACTIVE)));
        when(reservations.findByEnrollmentId(100L)).thenReturn(Optional.empty());
        when(courses.reserveSeat(1L, CourseStatus.ACTIVE)).thenReturn(1);

        SeatResponse r = service.reserve(1L, 100L);

        assertThat(r.replayed()).isFalse();
        assertThat(r.availableSeats()).isEqualTo(7);
        ArgumentCaptor<SeatReservation> saved = ArgumentCaptor.forClass(SeatReservation.class);
        verify(reservations).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ReservationStatus.RESERVED);
        verify(evictor).evictAfterCommit(1L);
        verifyNoInteractions(events);   // 7 > threshold 5
    }

    @Test
    void reservePublishesLowAvailabilityAtOrBelowThreshold() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(6, CourseStatus.ACTIVE)), Optional.of(course(5, CourseStatus.ACTIVE)));
        when(reservations.findByEnrollmentId(100L)).thenReturn(Optional.empty());
        when(courses.reserveSeat(1L, CourseStatus.ACTIVE)).thenReturn(1);

        service.reserve(1L, 100L);

        ArgumentCaptor<Object> event = ArgumentCaptor.forClass(Object.class);
        verify(events).publishEvent(event.capture());
        assertThat(event.getValue()).isInstanceOf(LowAvailabilityDetected.class);
        assertThat(((LowAvailabilityDetected) event.getValue()).availableSeats()).isEqualTo(5);
    }

    @Test
    void soldOutCourseIsAConflictAndNothingIsStored() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(0, CourseStatus.ACTIVE)));
        when(reservations.findByEnrollmentId(100L)).thenReturn(Optional.empty());
        when(courses.reserveSeat(1L, CourseStatus.ACTIVE)).thenReturn(0);

        assertThatThrownBy(() -> service.reserve(1L, 100L)).isInstanceOf(ConflictException.class).hasMessageContaining("No seats");
        verify(reservations, never()).saveAndFlush(any());
    }

    @Test
    void inactiveCourseCannotBeReserved() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(5, CourseStatus.INACTIVE)));
        when(reservations.findByEnrollmentId(100L)).thenReturn(Optional.empty());
        when(courses.reserveSeat(1L, CourseStatus.ACTIVE)).thenReturn(0);
        assertThatThrownBy(() -> service.reserve(1L, 100L)).hasMessageContaining("not active");
    }

    @Test
    void reserveIsIdempotentPerEnrollment() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(7, CourseStatus.ACTIVE)));
        when(reservations.findByEnrollmentId(100L)).thenReturn(Optional.of(reservation(ReservationStatus.RESERVED, 1L)));

        SeatResponse r = service.reserve(1L, 100L);

        assertThat(r.replayed()).isTrue();
        verify(courses, never()).reserveSeat(any(), any());
    }

    @Test
    void reserveAfterReleaseOrForAnotherCourseIsRefused() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(7, CourseStatus.ACTIVE)));
        when(reservations.findByEnrollmentId(100L)).thenReturn(Optional.of(reservation(ReservationStatus.RELEASED, 1L)),
                Optional.of(reservation(ReservationStatus.RESERVED, 2L)));
        assertThatThrownBy(() -> service.reserve(1L, 100L)).hasMessageContaining("already released");
        assertThatThrownBy(() -> service.reserve(1L, 100L)).hasMessageContaining("another course");
    }

    @Test
    void releaseReturnsSeatAndMarksReservationReleased() {
        SeatReservation r = reservation(ReservationStatus.RESERVED, 1L);
        when(courses.findById(1L)).thenReturn(Optional.of(course(7, CourseStatus.ACTIVE)), Optional.of(course(8, CourseStatus.ACTIVE)));
        when(reservations.findByEnrollmentId(100L)).thenReturn(Optional.of(r));

        SeatResponse resp = service.release(1L, 100L);

        verify(courses).releaseSeat(1L);
        assertThat(r.getStatus()).isEqualTo(ReservationStatus.RELEASED);
        assertThat(resp.replayed()).isFalse();
        assertThat(resp.availableSeats()).isEqualTo(8);
        verify(evictor).evictAfterCommit(1L);
    }

    @Test
    void releaseIsIdempotentForUnknownAndAlreadyReleasedReservations() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(7, CourseStatus.ACTIVE)));
        when(reservations.findByEnrollmentId(100L)).thenReturn(Optional.empty(), Optional.of(reservation(ReservationStatus.RELEASED, 1L)));
        assertThat(service.release(1L, 100L).replayed()).isTrue();
        assertThat(service.release(1L, 100L).replayed()).isTrue();
        verify(courses, never()).releaseSeat(any());
    }

    @Test
    void unknownCourseIs404() {
        when(courses.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.reserve(9L, 1L)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.release(9L, 1L)).isInstanceOf(ResourceNotFoundException.class);
    }
}
