package com.studentmgmt.student.dao;

import com.studentmgmt.student.model.StudentLogin;
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
public class StudentLoginDaoImpl implements StudentLoginDao {

    private final JdbcTemplate jdbcTemplate;

    public StudentLoginDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static StudentLogin mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        StudentLogin login = new StudentLogin();
        login.setLoginId(rs.getLong("login_id"));
        login.setStudentId(rs.getLong("student_id"));
        login.setUsername(rs.getString("username"));
        login.setPasswordHash(rs.getString("password_hash"));
        login.setActive(rs.getBoolean("is_active"));
        java.sql.Timestamp lastLogin = rs.getTimestamp("last_login");
        login.setLastLogin(lastLogin != null ? lastLogin.toLocalDateTime() : null);
        java.sql.Timestamp createdAt = rs.getTimestamp("created_at");
        login.setCreatedAt(createdAt != null ? createdAt.toLocalDateTime() : null);
        return login;
    }

    @Override
    public List<StudentLogin> findAll() {
        return jdbcTemplate.query("SELECT * FROM Student_Login ORDER BY login_id", StudentLoginDaoImpl::mapRow);
    }

    @Override
    public Optional<StudentLogin> findById(Long loginId) {
        try {
            StudentLogin login = jdbcTemplate.queryForObject(
                    "SELECT * FROM Student_Login WHERE login_id = ?", StudentLoginDaoImpl::mapRow, loginId);
            return Optional.ofNullable(login);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public Optional<StudentLogin> findByStudentId(Long studentId) {
        try {
            StudentLogin login = jdbcTemplate.queryForObject(
                    "SELECT * FROM Student_Login WHERE student_id = ?", StudentLoginDaoImpl::mapRow, studentId);
            return Optional.ofNullable(login);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public StudentLogin save(StudentLogin login) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Student_Login (student_id, username, password_hash, is_active) VALUES (?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, login.getStudentId());
            ps.setString(2, login.getUsername());
            ps.setString(3, login.getPasswordHash());
            ps.setBoolean(4, login.getActive() != null ? login.getActive() : true);
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public StudentLogin update(Long loginId, StudentLogin login) {
        jdbcTemplate.update(
                "UPDATE Student_Login SET username = ?, password_hash = ?, is_active = ? WHERE login_id = ?",
                login.getUsername(), login.getPasswordHash(), login.getActive(), loginId);
        return findById(loginId).orElseThrow();
    }

    @Override
    public void deleteById(Long loginId) {
        jdbcTemplate.update("DELETE FROM Student_Login WHERE login_id = ?", loginId);
    }
}
