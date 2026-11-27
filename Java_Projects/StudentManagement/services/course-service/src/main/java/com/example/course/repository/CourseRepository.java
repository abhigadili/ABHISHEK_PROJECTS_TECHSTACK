package com.example.course.repository;

import com.example.course.entity.Course;
import com.example.course.entity.CourseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseRepository extends JpaRepository<Course, Long>, JpaSpecificationExecutor<Course> {
    boolean existsByCourseCodeIgnoreCase(String code);
    boolean existsByCourseCodeIgnoreCaseAndCourseIdNot(String code, Long id);
    boolean existsByCategory_CategoryId(Long categoryId);

    /**
     * Atomic conditional decrement: the WHERE clause is evaluated under InnoDB's row lock, so N concurrent callers
     * can never take more than the seats that exist. Returns 1 on success, 0 when sold out / inactive.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Course c set c.availableSeats = c.availableSeats - 1, c.version = c.version + 1 "
            + "where c.courseId = :id and c.availableSeats > 0 and c.status = :active")
    int reserveSeat(@Param("id") Long id, @Param("active") CourseStatus active);

    /** Atomic conditional increment, never above capacity. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Course c set c.availableSeats = c.availableSeats + 1, c.version = c.version + 1 "
            + "where c.courseId = :id and c.availableSeats < c.totalSeats")
    int releaseSeat(@Param("id") Long id);

    /**
     * Changes capacity while preserving the number of seats already taken. NOTE: MySQL evaluates SET assignments left
     * to right, so availableSeats must be assigned BEFORE totalSeats (it reads the old total_seats).
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Course c set c.availableSeats = c.availableSeats + (:total - c.totalSeats), c.totalSeats = :total, "
            + "c.version = c.version + 1 where c.courseId = :id and c.availableSeats + (:total - c.totalSeats) >= 0")
    int changeCapacity(@Param("id") Long id, @Param("total") int total);
}
