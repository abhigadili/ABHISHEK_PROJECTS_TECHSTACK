package com.example.student.service;

import com.example.common.exception.ConflictException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.student.dto.EligibilityResponse;
import com.example.student.dto.StudentRequest;
import com.example.student.dto.StudentResponse;
import com.example.student.entity.Gender;
import com.example.student.entity.Student;
import com.example.student.entity.StudentStatus;
import com.example.student.mapper.StudentMapper;
import com.example.student.repository.StudentRepository;
import com.example.student.repository.StudentSpecifications;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudentService {
    public static final String CACHE = "students";
    private static final Logger log = LoggerFactory.getLogger(StudentService.class);

    private final StudentRepository repository;
    private final StudentMapper mapper;

    public StudentService(StudentRepository repository, StudentMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional
    public StudentResponse create(StudentRequest request) {
        if (repository.existsByEmailIgnoreCase(request.email().trim())) {
            throw new ConflictException("A student with email '" + request.email() + "' already exists");
        }
        Student saved = repository.save(mapper.toEntity(request));
        log.info("Created student id={}", saved.getStudentId());
        return mapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CACHE, key = "#id")
    public StudentResponse getById(Long id) {
        return mapper.toResponse(find(id));
    }

    @Transactional(readOnly = true)
    public Page<StudentResponse> search(String search, StudentStatus status, Gender gender, Pageable pageable) {
        return repository.findAll(StudentSpecifications.filter(search, status, gender), pageable).map(mapper::toResponse);
    }

    @Transactional
    @CachePut(cacheNames = CACHE, key = "#id")
    public StudentResponse update(Long id, StudentRequest request) {
        Student s = find(id);
        if (repository.existsByEmailIgnoreCaseAndStudentIdNot(request.email().trim(), id)) {
            throw new ConflictException("A student with email '" + request.email() + "' already exists");
        }
        mapper.apply(request, s);
        return mapper.toResponse(repository.saveAndFlush(s));
    }

    @Transactional
    @CachePut(cacheNames = CACHE, key = "#id")
    public StudentResponse updateStatus(Long id, StudentStatus status) {
        Student s = find(id);
        s.setStatus(status);
        log.info("Student id={} status -> {}", id, status);
        return mapper.toResponse(repository.saveAndFlush(s));
    }

    @Transactional
    @CacheEvict(cacheNames = CACHE, key = "#id")
    public void delete(Long id) {
        repository.delete(find(id));
        log.info("Deleted student id={}", id);
    }

    /** Used by Enrollment Service: only ACTIVE students may enroll. */
    public EligibilityResponse eligibility(Long id) {
        StudentResponse s = getById(id);
        boolean ok = s.status() == StudentStatus.ACTIVE;
        return new EligibilityResponse(id, ok, ok ? null : "Student is " + s.status());
    }

    private Student find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Student " + id + " not found"));
    }
}
