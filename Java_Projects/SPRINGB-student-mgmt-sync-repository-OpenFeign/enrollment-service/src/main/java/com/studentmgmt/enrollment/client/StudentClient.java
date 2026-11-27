package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.StudentDto;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import feign.FeignException;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Thin wrapper around StudentFeignClient that translates Feign's exceptions
 * (HTTP error responses, connection failures) into this service's own
 * PeerServiceException, so EnrollmentService/PaymentService never need to
 * know OpenFeign is the transport underneath — same contract as the
 * RestTemplate variant's StudentClient.
 */
@Component
public class StudentClient {

    private final StudentFeignClient studentFeignClient;

    public StudentClient(StudentFeignClient studentFeignClient) {
        this.studentFeignClient = studentFeignClient;
    }

    public boolean exists(Long studentId) {
        try {
            Map<String, Boolean> response = studentFeignClient.exists(studentId);
            return response != null && Boolean.TRUE.equals(response.get("exists"));
        } catch (FeignException e) {
            throw new PeerServiceException("student-service",
                    "Unable to verify student " + studentId + ": " + e.getMessage());
        }
    }

    public StudentDto getStudent(Long studentId) {
        try {
            return studentFeignClient.getStudent(studentId);
        } catch (FeignException e) {
            throw new PeerServiceException("student-service",
                    "Unable to fetch student " + studentId + ": " + e.getMessage());
        }
    }
}
