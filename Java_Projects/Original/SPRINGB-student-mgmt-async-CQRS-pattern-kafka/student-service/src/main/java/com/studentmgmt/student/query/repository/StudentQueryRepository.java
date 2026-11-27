package com.studentmgmt.student.query.repository;

import com.studentmgmt.student.query.entity.StudentView;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentQueryRepository extends JpaRepository<StudentView, Long> {
}
