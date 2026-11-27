package com.studentmgmt.enrollment.dao;

import com.studentmgmt.enrollment.model.EnrollmentValidation;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.util.Optional;

@Repository
public class EnrollmentValidationDaoImpl implements EnrollmentValidationDao {

    private final JdbcTemplate jdbcTemplate;

    public EnrollmentValidationDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static EnrollmentValidation mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        EnrollmentValidation validation = new EnrollmentValidation();
        validation.setEnrollmentId(rs.getLong("enrollment_id"));
        validation.setStudentValid((Boolean) rs.getObject("student_valid"));
        validation.setStudentReason(rs.getString("student_reason"));
        java.sql.Timestamp studentCheckedAt = rs.getTimestamp("student_checked_at");
        validation.setStudentCheckedAt(studentCheckedAt != null ? studentCheckedAt.toLocalDateTime() : null);
        validation.setCourseValid((Boolean) rs.getObject("course_valid"));
        validation.setCourseReason(rs.getString("course_reason"));
        java.sql.Timestamp courseCheckedAt = rs.getTimestamp("course_checked_at");
        validation.setCourseCheckedAt(courseCheckedAt != null ? courseCheckedAt.toLocalDateTime() : null);
        return validation;
    }

    @Override
    public void insertPending(Long enrollmentId) {
        jdbcTemplate.update("INSERT INTO Enrollment_Validation (enrollment_id) VALUES (?)", enrollmentId);
    }

    @Override
    public Optional<EnrollmentValidation> findById(Long enrollmentId) {
        try {
            EnrollmentValidation validation = jdbcTemplate.queryForObject(
                    "SELECT * FROM Enrollment_Validation WHERE enrollment_id = ?", EnrollmentValidationDaoImpl::mapRow, enrollmentId);
            return Optional.ofNullable(validation);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public void updateStudentResult(Long enrollmentId, boolean valid, String reason) {
        jdbcTemplate.update(
                "UPDATE Enrollment_Validation SET student_valid = ?, student_reason = ?, student_checked_at = NOW() " +
                        "WHERE enrollment_id = ?",
                valid, reason, enrollmentId);
    }

    @Override
    public void updateCourseResult(Long enrollmentId, boolean valid, String reason) {
        jdbcTemplate.update(
                "UPDATE Enrollment_Validation SET course_valid = ?, course_reason = ?, course_checked_at = NOW() " +
                        "WHERE enrollment_id = ?",
                valid, reason, enrollmentId);
    }
}
