package com.example.student.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.example.common.exception.ConflictException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.student.dto.StudentRequest;
import com.example.student.dto.StudentResponse;
import com.example.student.entity.Gender;
import com.example.student.entity.Student;
import com.example.student.entity.StudentStatus;
import com.example.student.mapper.StudentMapper;
import com.example.student.repository.StudentRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StudentServiceTest {
    @Mock StudentRepository repository;
    StudentService service;

    @BeforeEach
    void setUp() { service = new StudentService(repository, new StudentMapper()); }

    private static StudentRequest request(String email) {
        return new StudentRequest("  Asha ", "Rao", email, "+91 9876543210", LocalDate.of(2002, 5, 14), Gender.FEMALE, "Hyd", null, null);
    }

    private static Student stored(long id, StudentStatus status) {
        Student s = new Student();
        s.setStudentId(id); s.setFirstName("Asha"); s.setLastName("Rao"); s.setEmail("asha@example.com"); s.setStatus(status);
        return s;
    }

    @Test
    void createDefaultsStatusActiveEnrollmentDateAndNormalisesEmail() {
        when(repository.existsByEmailIgnoreCase("Asha@Example.com")).thenReturn(false);
        when(repository.save(any(Student.class))).thenAnswer(i -> i.getArgument(0));

        service.create(request("Asha@Example.com"));

        ArgumentCaptor<Student> saved = ArgumentCaptor.forClass(Student.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(StudentStatus.ACTIVE);
        assertThat(saved.getValue().getEnrollmentDate()).isEqualTo(LocalDate.now());
        assertThat(saved.getValue().getEmail()).isEqualTo("asha@example.com");
        assertThat(saved.getValue().getFirstName()).isEqualTo("Asha");
    }

    @Test
    void createRejectsDuplicateEmail() {
        when(repository.existsByEmailIgnoreCase("dup@example.com")).thenReturn(true);
        assertThatThrownBy(() -> service.create(request("dup@example.com"))).isInstanceOf(ConflictException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void getByIdThrowsWhenMissing() {
        when(repository.findById(5L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getById(5L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updateRejectsEmailOwnedByAnotherStudent() {
        when(repository.findById(1L)).thenReturn(Optional.of(stored(1, StudentStatus.ACTIVE)));
        when(repository.existsByEmailIgnoreCaseAndStudentIdNot("taken@example.com", 1L)).thenReturn(true);
        assertThatThrownBy(() -> service.update(1L, request("taken@example.com"))).isInstanceOf(ConflictException.class);
    }

    @Test
    void updateKeepsStatusWhenRequestHasNone() {
        Student s = stored(1, StudentStatus.INACTIVE);
        when(repository.findById(1L)).thenReturn(Optional.of(s));
        when(repository.saveAndFlush(s)).thenReturn(s);
        StudentResponse r = service.update(1L, request("asha@example.com"));
        assertThat(r.status()).isEqualTo(StudentStatus.INACTIVE);
    }

    @Test
    void eligibilityIsTrueOnlyForActiveStudents() {
        when(repository.findById(1L)).thenReturn(Optional.of(stored(1, StudentStatus.ACTIVE)));
        when(repository.findById(2L)).thenReturn(Optional.of(stored(2, StudentStatus.INACTIVE)));
        assertThat(service.eligibility(1L).eligible()).isTrue();
        var inactive = service.eligibility(2L);
        assertThat(inactive.eligible()).isFalse();
        assertThat(inactive.reason()).contains("INACTIVE");
    }

    @Test
    void updateStatusPersistsNewStatus() {
        Student s = stored(3, StudentStatus.ACTIVE);
        when(repository.findById(3L)).thenReturn(Optional.of(s));
        when(repository.saveAndFlush(s)).thenReturn(s);
        assertThat(service.updateStatus(3L, StudentStatus.INACTIVE).status()).isEqualTo(StudentStatus.INACTIVE);
    }
}
