package com.studentmgmt.course.dao;

import com.studentmgmt.course.model.CourseSchedule;
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
public class CourseScheduleDaoImpl implements CourseScheduleDao {

    private final JdbcTemplate jdbcTemplate;

    public CourseScheduleDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static CourseSchedule mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        CourseSchedule schedule = new CourseSchedule();
        schedule.setScheduleId(rs.getLong("schedule_id"));
        schedule.setCourseId(rs.getLong("course_id"));
        java.sql.Date startDate = rs.getDate("start_date");
        schedule.setStartDate(startDate != null ? startDate.toLocalDate() : null);
        java.sql.Date endDate = rs.getDate("end_date");
        schedule.setEndDate(endDate != null ? endDate.toLocalDate() : null);
        schedule.setClassDays(rs.getString("class_days"));
        java.sql.Time startTime = rs.getTime("start_time");
        schedule.setStartTime(startTime != null ? startTime.toLocalTime() : null);
        java.sql.Time endTime = rs.getTime("end_time");
        schedule.setEndTime(endTime != null ? endTime.toLocalTime() : null);
        schedule.setRoomNumber(rs.getString("room_number"));
        return schedule;
    }

    @Override
    public List<CourseSchedule> findAll() {
        return jdbcTemplate.query("SELECT * FROM Course_Schedule ORDER BY schedule_id", CourseScheduleDaoImpl::mapRow);
    }

    @Override
    public List<CourseSchedule> findByCourseId(Long courseId) {
        return jdbcTemplate.query(
                "SELECT * FROM Course_Schedule WHERE course_id = ? ORDER BY schedule_id",
                CourseScheduleDaoImpl::mapRow, courseId);
    }

    @Override
    public Optional<CourseSchedule> findById(Long scheduleId) {
        try {
            CourseSchedule schedule = jdbcTemplate.queryForObject(
                    "SELECT * FROM Course_Schedule WHERE schedule_id = ?", CourseScheduleDaoImpl::mapRow, scheduleId);
            return Optional.ofNullable(schedule);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public CourseSchedule save(CourseSchedule schedule) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Course_Schedule (course_id, start_date, end_date, class_days, start_time, end_time, room_number) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, schedule.getCourseId());
            ps.setDate(2, schedule.getStartDate() != null ? java.sql.Date.valueOf(schedule.getStartDate()) : null);
            ps.setDate(3, schedule.getEndDate() != null ? java.sql.Date.valueOf(schedule.getEndDate()) : null);
            ps.setString(4, schedule.getClassDays());
            if (schedule.getStartTime() != null) {
                ps.setTime(5, java.sql.Time.valueOf(schedule.getStartTime()));
            } else {
                ps.setNull(5, Types.TIME);
            }
            if (schedule.getEndTime() != null) {
                ps.setTime(6, java.sql.Time.valueOf(schedule.getEndTime()));
            } else {
                ps.setNull(6, Types.TIME);
            }
            ps.setString(7, schedule.getRoomNumber());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public void deleteById(Long scheduleId) {
        jdbcTemplate.update("DELETE FROM Course_Schedule WHERE schedule_id = ?", scheduleId);
    }
}
