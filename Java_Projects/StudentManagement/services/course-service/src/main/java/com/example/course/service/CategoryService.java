package com.example.course.service;

import com.example.common.exception.ConflictException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.course.dto.CategoryDtos.*;
import com.example.course.entity.CourseCategory;
import com.example.course.mapper.CourseMapper;
import com.example.course.repository.CourseCategoryRepository;
import com.example.course.repository.CourseRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryService {
    private final CourseCategoryRepository categories;
    private final CourseRepository courses;
    private final CourseMapper mapper;

    public CategoryService(CourseCategoryRepository categories, CourseRepository courses, CourseMapper mapper) {
        this.categories = categories; this.courses = courses; this.mapper = mapper;
    }

    @Transactional
    public CategoryResponse create(CategoryRequest r) {
        if (categories.existsByNameIgnoreCase(r.name().trim())) throw new ConflictException("Category '" + r.name() + "' already exists");
        CourseCategory c = new CourseCategory();
        c.setName(r.name().trim());
        c.setDescription(r.description());
        return mapper.toResponse(categories.save(c));
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> list() { return categories.findAll().stream().map(mapper::toResponse).toList(); }

    @Transactional
    public CategoryResponse update(Long id, CategoryRequest r) {
        CourseCategory c = categories.findById(id).orElseThrow(() -> new ResourceNotFoundException("Category " + id + " not found"));
        if (!c.getName().equalsIgnoreCase(r.name().trim()) && categories.existsByNameIgnoreCase(r.name().trim())) {
            throw new ConflictException("Category '" + r.name() + "' already exists");
        }
        c.setName(r.name().trim());
        c.setDescription(r.description());
        return mapper.toResponse(categories.save(c));
    }

    @Transactional
    public void delete(Long id) {
        CourseCategory c = categories.findById(id).orElseThrow(() -> new ResourceNotFoundException("Category " + id + " not found"));
        if (courses.existsByCategory_CategoryId(id)) throw new ConflictException("Category is used by existing courses");
        categories.delete(c);
    }
}
