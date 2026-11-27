package com.studentmgmt.enrollment.dao;

import com.studentmgmt.enrollment.model.Enrollment;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

@Repository
public class EnrollmentDaoImpl implements EnrollmentDao {

    private static final String SELECT_WITH_STATUS =
            "SELECT e.*, es.status_name AS status_name " +
                    "FROM Enrollments e JOIN Enrollment_Status es ON e.status_id = es.status_id ";

    private final JdbcTemplate jdbcTemplate;

    public EnrollmentDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static Enrollment mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Enrollment enrollment = new Enrollment();
        enrollment.setEnrollmentId(rs.getLong("enrollment_id"));
        enrollment.setStudentId(rs.getLong("student_id"));
        enrollment.setCourseId(rs.getLong("course_id"));
        enrollment.setStatusId(rs.getLong("status_id"));
        enrollment.setStatusName(rs.getString("status_name"));
        java.sql.Date enrollmentDate = rs.getDate("enrollment_date");
        enrollment.setEnrollmentDate(enrollmentDate != null ? enrollmentDate.toLocalDate() : null);
        java.sql.Date completionDate = rs.getDate("completion_date");
        enrollment.setCompletionDate(completionDate != null ? completionDate.toLocalDate() : null);
        enrollment.setRejectionReason(rs.getString("rejection_reason"));
        java.sql.Timestamp createdAt = rs.getTimestamp("created_at");
        enrollment.setCreatedAt(createdAt != null ? createdAt.toLocalDateTime() : null);
        java.sql.Timestamp updatedAt = rs.getTimestamp("updated_at");
        enrollment.setUpdatedAt(updatedAt != null ? updatedAt.toLocalDateTime() : null);
        return enrollment;
    }

    @Override
    public List<Enrollment> findAll() {
        return jdbcTemplate.query(SELECT_WITH_STATUS + "ORDER BY e.enrollment_id", EnrollmentDaoImpl::mapRow);
    }

    @Override
    public List<Enrollment> findByStudentId(Long studentId) {
        return jdbcTemplate.query(
                SELECT_WITH_STATUS + "WHERE e.student_id = ? ORDER BY e.enrollment_id",
                EnrollmentDaoImpl::mapRow, studentId);
    }

    @Override
    public List<Enrollment> findByCourseId(Long courseId) {
        return jdbcTemplate.query(
                SELECT_WITH_STATUS + "WHERE e.course_id = ? ORDER BY e.enrollment_id",
                EnrollmentDaoImpl::mapRow, courseId);
    }

    @Override
    public Optional<Enrollment> findById(Long enrollmentId) {
        try {
            Enrollment enrollment = jdbcTemplate.queryForObject(
                    SELECT_WITH_STATUS + "WHERE e.enrollment_id = ?", EnrollmentDaoImpl::mapRow, enrollmentId);
            return Optional.ofNullable(enrollment);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public Enrollment save(Enrollment enrollment) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Enrollments (student_id, course_id, status_id, enrollment_date) VALUES (?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, enrollment.getStudentId());
            ps.setLong(2, enrollment.getCourseId());
            ps.setLong(3, enrollment.getStatusId());
            ps.setDate(4, java.sql.Date.valueOf(
                    enrollment.getEnrollmentDate() != null ? enrollment.getEnrollmentDate() : java.time.LocalDate.now()));
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public Enrollment update(Long enrollmentId, Enrollment enrollment) {
        jdbcTemplate.update(
                "UPDATE Enrollments SET student_id = ?, course_id = ?, status_id = ?, " +
                        "enrollment_date = ?, completion_date = ? WHERE enrollment_id = ?",
                enrollment.getStudentId(), enrollment.getCourseId(), enrollment.getStatusId(),
                enrollment.getEnrollmentDate(), enrollment.getCompletionDate(), enrollmentId);
        return findById(enrollmentId).orElseThrow();
    }

    @Override
    public void updateStatus(Long enrollmentId, Long statusId, String rejectionReason) {
        jdbcTemplate.update(
                "UPDATE Enrollments SET status_id = ?, rejection_reason = ? WHERE enrollment_id = ?",
                statusId, rejectionReason, enrollmentId);
    }

    @Override
    public void deleteById(Long enrollmentId) {
        jdbcTemplate.update("DELETE FROM Enrollments WHERE enrollment_id = ?", enrollmentId);
    }
}
