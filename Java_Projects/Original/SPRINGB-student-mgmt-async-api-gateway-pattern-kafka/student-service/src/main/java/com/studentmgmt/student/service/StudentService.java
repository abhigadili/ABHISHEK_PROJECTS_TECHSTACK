package com.studentmgmt.student.service;

import com.studentmgmt.student.entity.Student;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.repository.StudentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentService {

    private final StudentRepository studentRepository;

    public StudentService(StudentRepository studentRepository) {
        this.studentRepository = studentRepository;
    }

    public List<Student> findAll() {
        return studentRepository.findAll();
    }

    public Student findById(Long id) {
        return studentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + id));
    }

    public boolean existsById(Long id) {
        return studentRepository.existsById(id);
    }

    public Student create(Student student) {
        return studentRepository.save(student);
    }

    public Student update(Long id, Student student) {
        Student existing = findById(id);
        existing.setFirstName(student.getFirstName());
        existing.setLastName(student.getLastName());
        existing.setEmail(student.getEmail());
        existing.setPhone(student.getPhone());
        existing.setDateOfBirth(student.getDateOfBirth());
        existing.setGender(student.getGender());
        existing.setEnrollmentDate(student.getEnrollmentDate());
        return studentRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        studentRepository.deleteById(id);
    }
}
