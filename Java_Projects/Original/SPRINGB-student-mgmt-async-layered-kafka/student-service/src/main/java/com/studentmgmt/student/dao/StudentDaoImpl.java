package com.studentmgmt.student.dao;

import com.studentmgmt.student.model.Student;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Types;
import java.util.List;
import java.util.Optional;

/**
 * Hand-written DAO on top of Spring's JdbcTemplate — no JPA/Hibernate, no
 * Spring Data repository interface. This is the "DAO" step of the
 * Controller -> Service -> DAO layered architecture.
 */
@Repository
public class StudentDaoImpl implements StudentDao {

    private final JdbcTemplate jdbcTemplate;

    public StudentDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static Student mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Student student = new Student();
        student.setStudentId(rs.getLong("student_id"));
        student.setFirstName(rs.getString("first_name"));
        student.setLastName(rs.getString("last_name"));
        student.setEmail(rs.getString("email"));
        student.setPhone(rs.getString("phone"));
        java.sql.Date dob = rs.getDate("date_of_birth");
        student.setDateOfBirth(dob != null ? dob.toLocalDate() : null);
        student.setGender(rs.getString("gender"));
        java.sql.Date enrollmentDate = rs.getDate("enrollment_date");
        student.setEnrollmentDate(enrollmentDate != null ? enrollmentDate.toLocalDate() : null);
        java.sql.Timestamp createdAt = rs.getTimestamp("created_at");
        student.setCreatedAt(createdAt != null ? createdAt.toLocalDateTime() : null);
        java.sql.Timestamp updatedAt = rs.getTimestamp("updated_at");
        student.setUpdatedAt(updatedAt != null ? updatedAt.toLocalDateTime() : null);
        return student;
    }

    @Override
    public List<Student> findAll() {
        return jdbcTemplate.query("SELECT * FROM Students ORDER BY student_id", StudentDaoImpl::mapRow);
    }

    @Override
    public Optional<Student> findById(Long studentId) {
        try {
            Student student = jdbcTemplate.queryForObject(
                    "SELECT * FROM Students WHERE student_id = ?", StudentDaoImpl::mapRow, studentId);
            return Optional.ofNullable(student);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public boolean existsById(Long studentId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM Students WHERE student_id = ?", Integer.class, studentId);
        return count != null && count > 0;
    }

    @Override
    public Student save(Student student) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Students (first_name, last_name, email, phone, date_of_birth, gender, enrollment_date) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, student.getFirstName());
            ps.setString(2, student.getLastName());
            ps.setString(3, student.getEmail());
            ps.setString(4, student.getPhone());
            if (student.getDateOfBirth() != null) {
                ps.setDate(5, java.sql.Date.valueOf(student.getDateOfBirth()));
            } else {
                ps.setNull(5, Types.DATE);
            }
            ps.setString(6, student.getGender());
            if (student.getEnrollmentDate() != null) {
                ps.setDate(7, java.sql.Date.valueOf(student.getEnrollmentDate()));
            } else {
                ps.setNull(7, Types.DATE);
            }
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public Student update(Long studentId, Student student) {
        jdbcTemplate.update(
                "UPDATE Students SET first_name = ?, last_name = ?, email = ?, phone = ?, " +
                        "date_of_birth = ?, gender = ?, enrollment_date = ? WHERE student_id = ?",
                student.getFirstName(), student.getLastName(), student.getEmail(), student.getPhone(),
                student.getDateOfBirth(), student.getGender(), student.getEnrollmentDate(), studentId);
        return findById(studentId).orElseThrow();
    }

    @Override
    public void deleteById(Long studentId) {
        jdbcTemplate.update("DELETE FROM Students WHERE student_id = ?", studentId);
    }
}
