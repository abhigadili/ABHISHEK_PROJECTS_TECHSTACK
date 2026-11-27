package com.studentmgmt.course.dao;

import com.studentmgmt.course.model.CourseFaculty;
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
public class CourseFacultyDaoImpl implements CourseFacultyDao {

    private final JdbcTemplate jdbcTemplate;

    public CourseFacultyDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static CourseFaculty mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        CourseFaculty faculty = new CourseFaculty();
        faculty.setFacultyId(rs.getLong("faculty_id"));
        faculty.setCourseId(rs.getLong("course_id"));
        faculty.setFacultyName(rs.getString("faculty_name"));
        faculty.setEmail(rs.getString("email"));
        faculty.setDesignation(rs.getString("designation"));
        faculty.setDepartment(rs.getString("department"));
        return faculty;
    }

    @Override
    public List<CourseFaculty> findAll() {
        return jdbcTemplate.query("SELECT * FROM Course_Faculty ORDER BY faculty_id", CourseFacultyDaoImpl::mapRow);
    }

    @Override
    public List<CourseFaculty> findByCourseId(Long courseId) {
        return jdbcTemplate.query(
                "SELECT * FROM Course_Faculty WHERE course_id = ? ORDER BY faculty_id",
                CourseFacultyDaoImpl::mapRow, courseId);
    }

    @Override
    public Optional<CourseFaculty> findById(Long facultyId) {
        try {
            CourseFaculty faculty = jdbcTemplate.queryForObject(
                    "SELECT * FROM Course_Faculty WHERE faculty_id = ?", CourseFacultyDaoImpl::mapRow, facultyId);
            return Optional.ofNullable(faculty);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public CourseFaculty save(CourseFaculty faculty) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Course_Faculty (course_id, faculty_name, email, designation, department) " +
                            "VALUES (?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, faculty.getCourseId());
            ps.setString(2, faculty.getFacultyName());
            ps.setString(3, faculty.getEmail());
            ps.setString(4, faculty.getDesignation());
            ps.setString(5, faculty.getDepartment());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public void deleteById(Long facultyId) {
        jdbcTemplate.update("DELETE FROM Course_Faculty WHERE faculty_id = ?", facultyId);
    }
}
