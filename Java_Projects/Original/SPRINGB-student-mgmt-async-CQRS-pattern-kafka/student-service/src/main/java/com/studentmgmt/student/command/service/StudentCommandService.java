package com.studentmgmt.student.command.service;

import com.studentmgmt.student.command.entity.Student;
import com.studentmgmt.student.command.repository.StudentCommandRepository;
import com.studentmgmt.student.event.StudentChangedEvent;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.kafka.StudentChangedProducer;
import org.springframework.stereotype.Service;

@Service
public class StudentCommandService {

    private final StudentCommandRepository studentCommandRepository;
    private final StudentChangedProducer studentChangedProducer;

    public StudentCommandService(StudentCommandRepository studentCommandRepository,
                                  StudentChangedProducer studentChangedProducer) {
        this.studentCommandRepository = studentCommandRepository;
        this.studentChangedProducer = studentChangedProducer;
    }

    public Student create(Student student) {
        Student saved = studentCommandRepository.save(student);
        studentChangedProducer.publish(toEvent(StudentChangedEvent.CREATED, saved));
        return saved;
    }

    public Student update(Long id, Student student) {
        Student existing = studentCommandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + id));
        existing.setFirstName(student.getFirstName());
        existing.setLastName(student.getLastName());
        existing.setEmail(student.getEmail());
        existing.setPhone(student.getPhone());
        existing.setDateOfBirth(student.getDateOfBirth());
        existing.setGender(student.getGender());
        existing.setEnrollmentDate(student.getEnrollmentDate());
        Student saved = studentCommandRepository.save(existing);
        studentChangedProducer.publish(toEvent(StudentChangedEvent.UPDATED, saved));
        return saved;
    }

    public void delete(Long id) {
        Student existing = studentCommandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + id));
        studentCommandRepository.deleteById(id);
        studentChangedProducer.publish(toEvent(StudentChangedEvent.DELETED, existing));
    }

    private StudentChangedEvent toEvent(String operation, Student student) {
        StudentChangedEvent event = new StudentChangedEvent();
        event.setOperation(operation);
        event.setStudentId(student.getStudentId());
        event.setFirstName(student.getFirstName());
        event.setLastName(student.getLastName());
        event.setEmail(student.getEmail());
        event.setPhone(student.getPhone());
        event.setDateOfBirth(student.getDateOfBirth() != null ? student.getDateOfBirth().toString() : null);
        event.setGender(student.getGender());
        event.setEnrollmentDate(student.getEnrollmentDate() != null ? student.getEnrollmentDate().toString() : null);
        return event;
    }
}
