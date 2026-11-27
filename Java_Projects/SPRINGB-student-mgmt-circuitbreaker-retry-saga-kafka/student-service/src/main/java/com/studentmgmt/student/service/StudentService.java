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
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + id));
    }

    public boolean existsById(Long id) {
        return studentRepository.existsById(id);
    }

    public Student create(Student student) {
        student.setStudentId(null);
        return studentRepository.save(student);
    }

    public Student update(Long id, Student update) {
        Student existing = findById(id);
        existing.setFirstName(update.getFirstName());
        existing.setLastName(update.getLastName());
        existing.setEmail(update.getEmail());
        existing.setPhone(update.getPhone());
        existing.setEnrollmentDate(update.getEnrollmentDate());
        return studentRepository.save(existing);
    }

    public void delete(Long id) {
        if (!studentRepository.existsById(id)) {
            throw new ResourceNotFoundException("Student not found with id: " + id);
        }
        studentRepository.deleteById(id);
    }
}
