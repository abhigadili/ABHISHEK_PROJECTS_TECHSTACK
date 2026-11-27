package com.studentmgmt.course.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.course.entity.Course;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.service.CourseService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CourseController.class)
class CourseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CourseService courseService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void getByIdReturns200WithBody() throws Exception {
        Course course = new Course();
        course.setCourseId(2L);
        course.setCourseName("Spring Boot Microservices");
        when(courseService.findById(2L)).thenReturn(course);

        mockMvc.perform(get("/api/courses/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.courseName").value("Spring Boot Microservices"));
    }

    @Test
    void getByIdReturns404WhenMissing() throws Exception {
        when(courseService.findById(99L)).thenThrow(new ResourceNotFoundException("Course not found with id: 99"));

        mockMvc.perform(get("/api/courses/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void postWithMissingRequiredFieldReturns400() throws Exception {
        Course invalid = new Course(); // no courseName/credits/durationWeeks/fee → fails @Valid

        mockMvc.perform(post("/api/courses")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postWithValidBodyReturns201() throws Exception {
        Course toCreate = new Course();
        toCreate.setCourseName("Database Systems");
        toCreate.setCredits(3);
        toCreate.setDurationWeeks(10);
        toCreate.setFee(new BigDecimal("12000.00"));

        Course saved = new Course();
        saved.setCourseId(6L);
        saved.setCourseName("Database Systems");

        when(courseService.create(any())).thenReturn(saved);

        mockMvc.perform(post("/api/courses")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(toCreate)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.courseId").value(6));
    }
}
