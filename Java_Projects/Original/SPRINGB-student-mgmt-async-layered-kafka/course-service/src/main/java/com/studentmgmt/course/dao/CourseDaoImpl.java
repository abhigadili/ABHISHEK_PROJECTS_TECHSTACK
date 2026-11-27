package com.studentmgmt.course.dao;

import com.studentmgmt.course.model.Course;
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

@Repository
public class CourseDaoImpl implements CourseDao {

    private final JdbcTemplate jdbcTemplate;

    public CourseDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static Course mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Course course = new Course();
        course.setCourseId(rs.getLong("course_id"));
        course.setCategoryId(rs.getLong("category_id"));
        course.setCourseCode(rs.getString("course_code"));
        course.setCourseName(rs.getString("course_name"));
        course.setDescription(rs.getString("description"));
        Integer durationWeeks = (Integer) rs.getObject("duration_weeks");
        course.setDurationWeeks(durationWeeks);
        Integer credits = (Integer) rs.getObject("credits");
        course.setCredits(credits);
        course.setFee(rs.getBigDecimal("fee"));
        java.sql.Timestamp createdAt = rs.getTimestamp("created_at");
        course.setCreatedAt(createdAt != null ? createdAt.toLocalDateTime() : null);
        return course;
    }

    @Override
    public List<Course> findAll() {
        return jdbcTemplate.query("SELECT * FROM Courses ORDER BY course_id", CourseDaoImpl::mapRow);
    }

    @Override
    public Optional<Course> findById(Long courseId) {
        try {
            Course course = jdbcTemplate.queryForObject(
                    "SELECT * FROM Courses WHERE course_id = ?", CourseDaoImpl::mapRow, courseId);
            return Optional.ofNullable(course);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public boolean existsById(Long courseId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM Courses WHERE course_id = ?", Integer.class, courseId);
        return count != null && count > 0;
    }

    @Override
    public Course save(Course course) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Courses (category_id, course_code, course_name, description, duration_weeks, credits, fee) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, course.getCategoryId());
            ps.setString(2, course.getCourseCode());
            ps.setString(3, course.getCourseName());
            ps.setString(4, course.getDescription());
            if (course.getDurationWeeks() != null) {
                ps.setInt(5, course.getDurationWeeks());
            } else {
                ps.setNull(5, Types.INTEGER);
            }
            if (course.getCredits() != null) {
                ps.setInt(6, course.getCredits());
            } else {
                ps.setNull(6, Types.INTEGER);
            }
            ps.setBigDecimal(7, course.getFee());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public Course update(Long courseId, Course course) {
        jdbcTemplate.update(
                "UPDATE Courses SET category_id = ?, course_code = ?, course_name = ?, description = ?, " +
                        "duration_weeks = ?, credits = ?, fee = ? WHERE course_id = ?",
                course.getCategoryId(), course.getCourseCode(), course.getCourseName(), course.getDescription(),
                course.getDurationWeeks(), course.getCredits(), course.getFee(), courseId);
        return findById(courseId).orElseThrow();
    }

    @Override
    public void deleteById(Long courseId) {
        jdbcTemplate.update("DELETE FROM Courses WHERE course_id = ?", courseId);
    }
}
