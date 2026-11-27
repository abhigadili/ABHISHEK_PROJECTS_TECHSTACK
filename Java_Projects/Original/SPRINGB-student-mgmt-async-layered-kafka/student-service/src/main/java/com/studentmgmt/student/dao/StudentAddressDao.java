package com.studentmgmt.student.dao;

import com.studentmgmt.student.model.StudentAddress;

import java.util.List;
import java.util.Optional;

public interface StudentAddressDao {

    List<StudentAddress> findAll();

    List<StudentAddress> findByStudentId(Long studentId);

    Optional<StudentAddress> findById(Long addressId);

    StudentAddress save(StudentAddress address);

    StudentAddress update(Long addressId, StudentAddress address);

    void deleteById(Long addressId);
}
