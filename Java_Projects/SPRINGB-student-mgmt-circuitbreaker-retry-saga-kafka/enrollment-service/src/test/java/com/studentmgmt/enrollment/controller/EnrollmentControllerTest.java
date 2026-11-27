package com.studentmgmt.enrollment.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.enrollment.dto.CourseSummary;
import com.studentmgmt.enrollment.dto.EnrollmentDetails;
import com.studentmgmt.enrollment.dto.StudentSummary;
import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.service.EnrollmentDetailsService;
import com.studentmgmt.enrollment.service.EnrollmentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(EnrollmentController.class)
class EnrollmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private EnrollmentService enrollmentService;

    @MockBean
    private EnrollmentDetailsService enrollmentDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void postReturns202AcceptedNotDefault200() throws Exception {
        Enrollment toCreate = new Enrollment();
        toCreate.setStudentId(1L);
        toCreate.setCourseId(3L);

        Enrollment saved = new Enrollment();
        saved.setEnrollmentId(37L);
        saved.setStudentId(1L);
        saved.setCourseId(3L);
        saved.setStatusId(1L);

        when(enrollmentService.create(any())).thenReturn(saved);

        mockMvc.perform(post("/api/enrollments")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(toCreate)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.enrollmentId").value(37));
    }

    @Test
    void getByIdReturns404WhenMissing() throws Exception {
        when(enrollmentService.findById(99L)).thenThrow(new ResourceNotFoundException("Enrollment not found with id: 99"));

        mockMvc.perform(get("/api/enrollments/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void detailsEndpointAggregatesStudentAndCourseSummaries() throws Exception {
        StudentSummary student = new StudentSummary();
        student.setStudentId(1L);
        student.setFirstName("Aarav");

        CourseSummary course = new CourseSummary();
        course.setCourseId(3L);
        course.setCourseName("Apache Kafka Essentials");

        when(enrollmentDetailsService.getDetails(37L))
                .thenReturn(new EnrollmentDetails(37L, "CONFIRMED", student, course));

        mockMvc.perform(get("/api/enrollments/37/details"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.student.firstName").value("Aarav"))
                .andExpect(jsonPath("$.course.courseName").value("Apache Kafka Essentials"));
    }
}
