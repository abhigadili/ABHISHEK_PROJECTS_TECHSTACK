package com.studentmgmt.student.repository;

import com.studentmgmt.student.entity.StudentAddress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentAddressRepository extends JpaRepository<StudentAddress, Long> {

    List<StudentAddress> findByStudentId(Long studentId);
}
