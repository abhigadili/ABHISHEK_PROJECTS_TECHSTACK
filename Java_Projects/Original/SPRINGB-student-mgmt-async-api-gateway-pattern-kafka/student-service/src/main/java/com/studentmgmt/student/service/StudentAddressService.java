package com.studentmgmt.student.service;

import com.studentmgmt.student.entity.StudentAddress;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.repository.StudentAddressRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentAddressService {

    private final StudentAddressRepository studentAddressRepository;

    public StudentAddressService(StudentAddressRepository studentAddressRepository) {
        this.studentAddressRepository = studentAddressRepository;
    }

    public List<StudentAddress> findAll(Long studentId) {
        if (studentId != null) {
            return studentAddressRepository.findByStudentId(studentId);
        }
        return studentAddressRepository.findAll();
    }

    public StudentAddress findById(Long id) {
        return studentAddressRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student address not found: " + id));
    }

    public StudentAddress create(StudentAddress address) {
        return studentAddressRepository.save(address);
    }

    public StudentAddress update(Long id, StudentAddress address) {
        StudentAddress existing = findById(id);
        existing.setStudentId(address.getStudentId());
        existing.setAddressType(address.getAddressType());
        existing.setAddressLine1(address.getAddressLine1());
        existing.setAddressLine2(address.getAddressLine2());
        existing.setCity(address.getCity());
        existing.setState(address.getState());
        existing.setPostalCode(address.getPostalCode());
        existing.setCountry(address.getCountry());
        return studentAddressRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        studentAddressRepository.deleteById(id);
    }
}
