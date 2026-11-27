package com.example.student.dto;

import com.example.student.entity.Gender;
import com.example.student.entity.StudentStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record StudentResponse(Long studentId, String firstName, String lastName, String email, String phoneNumber,
                              LocalDate dateOfBirth, Gender gender, String address, LocalDate enrollmentDate,
                              StudentStatus status, LocalDateTime createdAt, LocalDateTime updatedAt) {
}
