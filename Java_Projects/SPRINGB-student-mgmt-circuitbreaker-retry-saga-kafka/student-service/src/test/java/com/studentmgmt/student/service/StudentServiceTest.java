package com.studentmgmt.student.service;

import com.studentmgmt.student.entity.Student;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.repository.StudentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentServiceTest {

    @Mock
    private StudentRepository studentRepository;

    @InjectMocks
    private StudentService studentService;

    @Test
    void findByIdReturnsStudentWhenPresent() {
        Student student = new Student();
        student.setStudentId(1L);
        student.setFirstName("Aarav");
        when(studentRepository.findById(1L)).thenReturn(Optional.of(student));

        Student result = studentService.findById(1L);

        assertThat(result.getFirstName()).isEqualTo("Aarav");
    }

    @Test
    void findByIdThrowsWhenMissing() {
        when(studentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studentService.findById(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void createAlwaysIgnoresAnyClientSuppliedId() {
        Student incoming = new Student();
        incoming.setStudentId(999L);
        incoming.setFirstName("Diya");
        when(studentRepository.save(incoming)).thenReturn(incoming);

        studentService.create(incoming);

        assertThat(incoming.getStudentId()).isNull();
        verify(studentRepository).save(incoming);
    }

    @Test
    void deleteThrowsWhenStudentDoesNotExist() {
        when(studentRepository.existsById(42L)).thenReturn(false);

        assertThatThrownBy(() -> studentService.delete(42L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
