package com.studentmgmt.student.service;

import com.studentmgmt.student.dao.StudentAddressDao;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.model.StudentAddress;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentAddressServiceImpl implements StudentAddressService {

    private final StudentAddressDao studentAddressDao;

    public StudentAddressServiceImpl(StudentAddressDao studentAddressDao) {
        this.studentAddressDao = studentAddressDao;
    }

    @Override
    public List<StudentAddress> findAll() {
        return studentAddressDao.findAll();
    }

    @Override
    public List<StudentAddress> findByStudentId(Long studentId) {
        return studentAddressDao.findByStudentId(studentId);
    }

    @Override
    public StudentAddress findById(Long addressId) {
        return studentAddressDao.findById(addressId)
                .orElseThrow(() -> new ResourceNotFoundException("Student address not found: " + addressId));
    }

    @Override
    public StudentAddress create(StudentAddress address) {
        return studentAddressDao.save(address);
    }

    @Override
    public StudentAddress update(Long addressId, StudentAddress address) {
        findById(addressId);
        return studentAddressDao.update(addressId, address);
    }

    @Override
    public void delete(Long addressId) {
        findById(addressId);
        studentAddressDao.deleteById(addressId);
    }
}
