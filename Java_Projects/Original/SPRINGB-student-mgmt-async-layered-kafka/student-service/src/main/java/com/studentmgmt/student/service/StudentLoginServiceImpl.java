package com.studentmgmt.student.service;

import com.studentmgmt.student.dao.StudentLoginDao;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.model.StudentLogin;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentLoginServiceImpl implements StudentLoginService {

    private final StudentLoginDao studentLoginDao;

    public StudentLoginServiceImpl(StudentLoginDao studentLoginDao) {
        this.studentLoginDao = studentLoginDao;
    }

    @Override
    public List<StudentLogin> findAll() {
        return studentLoginDao.findAll();
    }

    @Override
    public StudentLogin findById(Long loginId) {
        return studentLoginDao.findById(loginId)
                .orElseThrow(() -> new ResourceNotFoundException("Student login not found: " + loginId));
    }

    @Override
    public StudentLogin findByStudentId(Long studentId) {
        return studentLoginDao.findByStudentId(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student login not found for student: " + studentId));
    }

    @Override
    public StudentLogin create(StudentLogin login) {
        return studentLoginDao.save(login);
    }

    @Override
    public StudentLogin update(Long loginId, StudentLogin login) {
        findById(loginId);
        return studentLoginDao.update(loginId, login);
    }

    @Override
    public void delete(Long loginId) {
        findById(loginId);
        studentLoginDao.deleteById(loginId);
    }
}
