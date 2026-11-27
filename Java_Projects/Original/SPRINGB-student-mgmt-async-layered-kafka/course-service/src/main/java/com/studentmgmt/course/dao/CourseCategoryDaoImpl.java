package com.studentmgmt.course.dao;

import com.studentmgmt.course.model.CourseCategory;
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
public class CourseCategoryDaoImpl implements CourseCategoryDao {

    private final JdbcTemplate jdbcTemplate;

    public CourseCategoryDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static CourseCategory mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        CourseCategory category = new CourseCategory();
        category.setCategoryId(rs.getLong("category_id"));
        category.setCategoryName(rs.getString("category_name"));
        category.setDescription(rs.getString("description"));
        return category;
    }

    @Override
    public List<CourseCategory> findAll() {
        return jdbcTemplate.query("SELECT * FROM Course_Category ORDER BY category_id", CourseCategoryDaoImpl::mapRow);
    }

    @Override
    public Optional<CourseCategory> findById(Long categoryId) {
        try {
            CourseCategory category = jdbcTemplate.queryForObject(
                    "SELECT * FROM Course_Category WHERE category_id = ?", CourseCategoryDaoImpl::mapRow, categoryId);
            return Optional.ofNullable(category);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public CourseCategory save(CourseCategory category) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Course_Category (category_name, description) VALUES (?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, category.getCategoryName());
            ps.setString(2, category.getDescription());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public CourseCategory update(Long categoryId, CourseCategory category) {
        jdbcTemplate.update(
                "UPDATE Course_Category SET category_name = ?, description = ? WHERE category_id = ?",
                category.getCategoryName(), category.getDescription(), categoryId);
        return findById(categoryId).orElseThrow();
    }

    @Override
    public void deleteById(Long categoryId) {
        jdbcTemplate.update("DELETE FROM Course_Category WHERE category_id = ?", categoryId);
    }
}
