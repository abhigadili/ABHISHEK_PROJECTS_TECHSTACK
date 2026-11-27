package com.studentmgmt.enrollment.dao;

import com.studentmgmt.enrollment.model.EnrollmentStatus;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.util.List;
import java.util.Optional;

@Repository
public class EnrollmentStatusDaoImpl implements EnrollmentStatusDao {

    private final JdbcTemplate jdbcTemplate;

    public EnrollmentStatusDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static EnrollmentStatus mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        EnrollmentStatus status = new EnrollmentStatus();
        status.setStatusId(rs.getLong("status_id"));
        status.setStatusName(rs.getString("status_name"));
        status.setDescription(rs.getString("description"));
        return status;
    }

    @Override
    public List<EnrollmentStatus> findAll() {
        return jdbcTemplate.query("SELECT * FROM Enrollment_Status ORDER BY status_id", EnrollmentStatusDaoImpl::mapRow);
    }

    @Override
    public Optional<EnrollmentStatus> findById(Long statusId) {
        try {
            EnrollmentStatus status = jdbcTemplate.queryForObject(
                    "SELECT * FROM Enrollment_Status WHERE status_id = ?", EnrollmentStatusDaoImpl::mapRow, statusId);
            return Optional.ofNullable(status);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public Optional<EnrollmentStatus> findByStatusName(String statusName) {
        try {
            EnrollmentStatus status = jdbcTemplate.queryForObject(
                    "SELECT * FROM Enrollment_Status WHERE status_name = ?", EnrollmentStatusDaoImpl::mapRow, statusName);
            return Optional.ofNullable(status);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }
}
