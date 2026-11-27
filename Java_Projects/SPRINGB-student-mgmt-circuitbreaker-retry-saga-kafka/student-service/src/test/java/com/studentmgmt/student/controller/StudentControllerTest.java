package com.studentmgmt.student.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.student.entity.Student;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.service.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * @WebMvcTest loads only the web layer (this controller + Spring MVC infra),
 * mocking StudentService — no DataSource, no Kafka, no live MySQL needed, so
 * this runs anywhere `mvn test` runs, including this sandbox.
 */
@WebMvcTest(StudentController.class)
class StudentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StudentService studentService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void getByIdReturns200WithBody() throws Exception {
        Student student = new Student();
        student.setStudentId(1L);
        student.setFirstName("Aarav");
        student.setLastName("Sharma");
        student.setEmail("aarav.sharma@example.com");
        when(studentService.findById(1L)).thenReturn(student);

        mockMvc.perform(get("/api/students/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Aarav"));
    }

    @Test
    void getByIdReturns404WhenMissing() throws Exception {
        when(studentService.findById(99L)).thenThrow(new ResourceNotFoundException("Student not found with id: 99"));

        mockMvc.perform(get("/api/students/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Student not found with id: 99"));
    }

    @Test
    void postWithMissingRequiredFieldReturns400() throws Exception {
        Student invalid = new Student(); // no firstName/lastName/email → fails @Valid

        mockMvc.perform(post("/api/students")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postWithValidBodyReturns201() throws Exception {
        Student toCreate = new Student();
        toCreate.setFirstName("Diya");
        toCreate.setLastName("Patel");
        toCreate.setEmail("diya.patel@example.com");

        Student saved = new Student();
        saved.setStudentId(6L);
        saved.setFirstName("Diya");
        saved.setLastName("Patel");
        saved.setEmail("diya.patel@example.com");

        when(studentService.create(org.mockito.ArgumentMatchers.any())).thenReturn(saved);

        mockMvc.perform(post("/api/students")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(toCreate)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.studentId").value(6));
    }
}
