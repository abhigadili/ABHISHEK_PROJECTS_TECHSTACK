package com.example.course.service;

import com.example.common.exception.BusinessRuleException;
import com.example.common.exception.ConflictException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.course.config.CourseCacheEvictor;
import com.example.course.dto.CourseAvailabilityResponse;
import com.example.course.dto.CourseRequest;
import com.example.course.dto.CourseResponse;
import com.example.course.entity.Course;
import com.example.course.entity.CourseCategory;
import com.example.course.entity.CourseStatus;
import com.example.course.mapper.CourseMapper;
import com.example.course.repository.CourseCategoryRepository;
import com.example.course.repository.CourseRepository;
import com.example.course.repository.CourseSpecifications;
import java.math.BigDecimal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CourseService {
    private static final Logger log = LoggerFactory.getLogger(CourseService.class);

    private final CourseRepository courses;
    private final CourseCategoryRepository categories;
    private final CourseMapper mapper;
    private final CourseCacheEvictor evictor;

    public CourseService(CourseRepository courses, CourseCategoryRepository categories, CourseMapper mapper, CourseCacheEvictor evictor) {
        this.courses = courses; this.categories = categories; this.mapper = mapper; this.evictor = evictor;
    }

    @Transactional
    public CourseResponse create(CourseRequest r) {
        if (courses.existsByCourseCodeIgnoreCase(r.courseCode().trim())) throw new ConflictException("Course code '" + r.courseCode() + "' already exists");
        Course saved = courses.save(mapper.toEntity(r, category(r.categoryId())));
        log.info("Created course id={} code={}", saved.getCourseId(), saved.getCourseCode());
        return mapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CourseCacheEvictor.COURSES, key = "#id")
    public CourseResponse getById(Long id) { return mapper.toResponse(find(id)); }

    /** Cached separately with a short TTL; evicted after any seat change commits. */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CourseCacheEvictor.AVAILABILITY, key = "#id")
    public CourseAvailabilityResponse availability(Long id) { return mapper.toAvailability(find(id)); }

    @Transactional(readOnly = true)
    public Page<CourseResponse> search(String search, Long categoryId, CourseStatus status, BigDecimal minFees,
                                       BigDecimal maxFees, boolean availableOnly, Pageable pageable) {
        return courses.findAll(CourseSpecifications.filter(search, categoryId, status, minFees, maxFees, availableOnly), pageable)
                .map(mapper::toResponse);
    }

    @Transactional
    public CourseResponse update(Long id, CourseRequest r) {
        Course c = find(id);
        if (courses.existsByCourseCodeIgnoreCaseAndCourseIdNot(r.courseCode().trim(), id)) {
            throw new ConflictException("Course code '" + r.courseCode() + "' already exists");
        }
        mapper.apply(r, c, category(r.categoryId()));
        courses.saveAndFlush(c);
        if (r.totalSeats() != c.getTotalSeats()) {
            if (courses.changeCapacity(id, r.totalSeats()) == 0) {
                throw new BusinessRuleException("totalSeats " + r.totalSeats() + " is below the number of seats already reserved");
            }
        }
        evictor.evictAfterCommit(id);
        return mapper.toResponse(find(id));
    }

    @Transactional
    public CourseResponse updateStatus(Long id, CourseStatus status) {
        Course c = find(id);
        c.setStatus(status);
        courses.saveAndFlush(c);
        evictor.evictAfterCommit(id);
        return mapper.toResponse(c);
    }

    @Transactional
    public void delete(Long id) {
        courses.delete(find(id));
        courses.flush();
        evictor.evictAfterCommit(id);
        log.info("Deleted course id={}", id);
    }

    Course find(Long id) { return courses.findById(id).orElseThrow(() -> new ResourceNotFoundException("Course " + id + " not found")); }

    private CourseCategory category(Long id) {
        if (id == null) return null;
        return categories.findById(id).orElseThrow(() -> new BusinessRuleException("Category " + id + " does not exist"));
    }
}
