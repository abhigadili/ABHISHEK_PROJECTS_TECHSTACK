package com.studentmgmt.course.service;

import com.studentmgmt.course.entity.Course;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.repository.CourseRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseServiceTest {

    @Mock
    private CourseRepository courseRepository;

    @InjectMocks
    private CourseService courseService;

    @Test
    void findByIdReturnsCourseWhenPresent() {
        Course course = new Course();
        course.setCourseId(1L);
        course.setCourseName("Kafka Essentials");
        when(courseRepository.findById(1L)).thenReturn(Optional.of(course));

        Course result = courseService.findById(1L);

        assertThat(result.getCourseName()).isEqualTo("Kafka Essentials");
    }

    @Test
    void findByIdThrowsWhenMissing() {
        when(courseRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> courseService.findById(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void createAlwaysIgnoresAnyClientSuppliedId() {
        Course incoming = new Course();
        incoming.setCourseId(999L);
        incoming.setCourseName("Distributed Systems Patterns");
        incoming.setCredits(3);
        incoming.setDurationWeeks(6);
        incoming.setFee(new BigDecimal("25000.00"));
        when(courseRepository.save(incoming)).thenReturn(incoming);

        courseService.create(incoming);

        assertThat(incoming.getCourseId()).isNull();
    }

    @Test
    void deleteThrowsWhenCourseDoesNotExist() {
        when(courseRepository.existsById(42L)).thenReturn(false);

        assertThatThrownBy(() -> courseService.delete(42L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
