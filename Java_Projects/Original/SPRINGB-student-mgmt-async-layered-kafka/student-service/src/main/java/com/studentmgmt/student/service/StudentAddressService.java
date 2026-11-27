package com.studentmgmt.student.service;

import com.studentmgmt.student.model.StudentAddress;

import java.util.List;

public interface StudentAddressService {

    List<StudentAddress> findAll();

    List<StudentAddress> findByStudentId(Long studentId);

    StudentAddress findById(Long addressId);

    StudentAddress create(StudentAddress address);

    StudentAddress update(Long addressId, StudentAddress address);

    void delete(Long addressId);
}
