package com.example.student.dto;

import com.example.student.entity.Gender;
import com.example.student.entity.StudentStatus;
import com.example.student.validation.ValidPhoneNumber;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record StudentRequest(
        @NotBlank @Size(max = 50) String firstName,
        @NotBlank @Size(max = 50) String lastName,
        @NotBlank @Email @Size(max = 100) String email,
        @ValidPhoneNumber String phoneNumber,
        @Past LocalDate dateOfBirth,
        Gender gender,
        @Size(max = 255) String address,
        LocalDate enrollmentDate,
        StudentStatus status) {
}
