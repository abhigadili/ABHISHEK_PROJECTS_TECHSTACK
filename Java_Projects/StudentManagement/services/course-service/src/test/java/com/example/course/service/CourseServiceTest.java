package com.example.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.example.common.exception.BusinessRuleException;
import com.example.common.exception.ConflictException;
import com.example.course.config.CourseCacheEvictor;
import com.example.course.dto.CourseRequest;
import com.example.course.entity.Course;
import com.example.course.entity.CourseStatus;
import com.example.course.mapper.CourseMapper;
import com.example.course.repository.CourseCategoryRepository;
import com.example.course.repository.CourseRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CourseServiceTest {
    @Mock CourseRepository courses;
    @Mock CourseCategoryRepository categories;
    @Mock CourseCacheEvictor evictor;
    CourseService service;

    @BeforeEach
    void setUp() { service = new CourseService(courses, categories, new CourseMapper(), evictor); }

    private static CourseRequest request(int totalSeats) {
        return new CourseRequest("Java", "JMS-101", "desc", null, 12, new BigDecimal("999.00"), totalSeats, null);
    }

    private static Course existing(int total, int available) {
        Course c = new Course();
        c.setCourseId(1L); c.setCourseCode("JMS-101"); c.setCourseName("Java"); c.setFees(BigDecimal.TEN); c.setStatus(CourseStatus.ACTIVE);
        c.setTotalSeats(total); c.setAvailableSeats(available);
        return c;
    }

    @Test
    void newCourseStartsWithAllSeatsAvailable() {
        when(courses.existsByCourseCodeIgnoreCase("JMS-101")).thenReturn(false);
        when(courses.save(any(Course.class))).thenAnswer(i -> i.getArgument(0));
        var r = service.create(request(30));
        assertThat(r.totalSeats()).isEqualTo(30);
        assertThat(r.availableSeats()).isEqualTo(30);
        assertThat(r.status()).isEqualTo(CourseStatus.ACTIVE);
    }

    @Test
    void duplicateCodeIsAConflict() {
        when(courses.existsByCourseCodeIgnoreCase("JMS-101")).thenReturn(true);
        assertThatThrownBy(() -> service.create(request(5))).isInstanceOf(ConflictException.class);
    }

    @Test
    void shrinkingCapacityBelowReservedSeatsIsRefused() {
        when(courses.findById(1L)).thenReturn(Optional.of(existing(10, 2)));   // 8 seats taken
        when(courses.existsByCourseCodeIgnoreCaseAndCourseIdNot("JMS-101", 1L)).thenReturn(false);
        when(courses.changeCapacity(1L, 5)).thenReturn(0);                    // WHERE available + delta >= 0 matched nothing
        assertThatThrownBy(() -> service.update(1L, request(5))).isInstanceOf(BusinessRuleException.class);
        verify(evictor, never()).evictAfterCommit(any());
    }

    @Test
    void unchangedCapacityDoesNotTouchSeatCounters() {
        when(courses.findById(1L)).thenReturn(Optional.of(existing(10, 4)));
        when(courses.existsByCourseCodeIgnoreCaseAndCourseIdNot("JMS-101", 1L)).thenReturn(false);
        service.update(1L, request(10));
        verify(courses, never()).changeCapacity(any(), anyInt());
        verify(evictor).evictAfterCommit(1L);
    }
}
