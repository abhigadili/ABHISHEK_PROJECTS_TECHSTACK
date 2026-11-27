package com.studentmgmt.student.service;

import com.studentmgmt.student.dao.StudentDao;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.model.Student;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentServiceImpl implements StudentService {

    private final StudentDao studentDao;

    public StudentServiceImpl(StudentDao studentDao) {
        this.studentDao = studentDao;
    }

    @Override
    public List<Student> findAll() {
        return studentDao.findAll();
    }

    @Override
    public Student findById(Long id) {
        return studentDao.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + id));
    }

    @Override
    public boolean existsById(Long id) {
        return studentDao.existsById(id);
    }

    @Override
    public Student create(Student student) {
        return studentDao.save(student);
    }

    @Override
    public Student update(Long id, Student student) {
        findById(id);
        return studentDao.update(id, student);
    }

    @Override
    public void delete(Long id) {
        findById(id);
        studentDao.deleteById(id);
    }
}
