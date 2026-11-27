package com.example.student.mapper;

import com.example.student.dto.StudentRequest;
import com.example.student.dto.StudentResponse;
import com.example.student.entity.Student;
import com.example.student.entity.StudentStatus;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

@Component
public class StudentMapper {

    public Student toEntity(StudentRequest r) {
        Student s = new Student();
        apply(r, s);
        if (s.getEnrollmentDate() == null) s.setEnrollmentDate(LocalDate.now());
        if (s.getStatus() == null) s.setStatus(StudentStatus.ACTIVE);
        return s;
    }

    /** Copies mutable profile fields. A null status/enrollmentDate in the request leaves the current value unchanged. */
    public void apply(StudentRequest r, Student s) {
        s.setFirstName(r.firstName().trim());
        s.setLastName(r.lastName().trim());
        s.setEmail(r.email().trim().toLowerCase());
        s.setPhoneNumber(r.phoneNumber());
        s.setDateOfBirth(r.dateOfBirth());
        s.setGender(r.gender());
        s.setAddress(r.address());
        if (r.enrollmentDate() != null) s.setEnrollmentDate(r.enrollmentDate());
        if (r.status() != null) s.setStatus(r.status());
    }

    public StudentResponse toResponse(Student s) {
        return new StudentResponse(s.getStudentId(), s.getFirstName(), s.getLastName(), s.getEmail(), s.getPhoneNumber(),
                s.getDateOfBirth(), s.getGender(), s.getAddress(), s.getEnrollmentDate(), s.getStatus(),
                s.getCreatedAt(), s.getUpdatedAt());
    }
}
