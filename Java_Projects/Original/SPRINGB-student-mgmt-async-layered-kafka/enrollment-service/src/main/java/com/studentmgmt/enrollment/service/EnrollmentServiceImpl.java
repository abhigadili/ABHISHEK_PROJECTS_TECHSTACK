package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.dao.EnrollmentDao;
import com.studentmgmt.enrollment.dao.EnrollmentValidationDao;
import com.studentmgmt.enrollment.event.EnrollmentRequestedEvent;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.kafka.EnrollmentRequestedProducer;
import com.studentmgmt.enrollment.model.Enrollment;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class EnrollmentServiceImpl implements EnrollmentService {

    private final EnrollmentDao enrollmentDao;
    private final EnrollmentValidationDao enrollmentValidationDao;
    private final EnrollmentStatusService enrollmentStatusService;
    private final EnrollmentRequestedProducer enrollmentRequestedProducer;

    public EnrollmentServiceImpl(EnrollmentDao enrollmentDao,
                                  EnrollmentValidationDao enrollmentValidationDao,
                                  EnrollmentStatusService enrollmentStatusService,
                                  EnrollmentRequestedProducer enrollmentRequestedProducer) {
        this.enrollmentDao = enrollmentDao;
        this.enrollmentValidationDao = enrollmentValidationDao;
        this.enrollmentStatusService = enrollmentStatusService;
        this.enrollmentRequestedProducer = enrollmentRequestedProducer;
    }

    @Override
    public List<Enrollment> findAll(Long studentId, Long courseId) {
        if (studentId != null) {
            return enrollmentDao.findByStudentId(studentId);
        }
        if (courseId != null) {
            return enrollmentDao.findByCourseId(courseId);
        }
        return enrollmentDao.findAll();
    }

    @Override
    public Enrollment findById(Long id) {
        return enrollmentDao.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found: " + id));
    }

    @Override
    public Enrollment create(Enrollment enrollment) {
        enrollment.setStatusId(enrollmentStatusService.findByStatusName("PENDING_VALIDATION").getStatusId());
        if (enrollment.getEnrollmentDate() == null) {
            enrollment.setEnrollmentDate(LocalDate.now());
        }

        Enrollment created = enrollmentDao.save(enrollment);
        enrollmentValidationDao.insertPending(created.getEnrollmentId());

        enrollmentRequestedProducer.publish(new EnrollmentRequestedEvent(
                created.getEnrollmentId(), created.getStudentId(), created.getCourseId(),
                LocalDateTime.now().toString()));

        return created;
    }

    @Override
    public Enrollment update(Long id, Enrollment enrollment) {
        findById(id);
        return enrollmentDao.update(id, enrollment);
    }

    @Override
    public void delete(Long id) {
        findById(id);
        enrollmentDao.deleteById(id);
    }
}
