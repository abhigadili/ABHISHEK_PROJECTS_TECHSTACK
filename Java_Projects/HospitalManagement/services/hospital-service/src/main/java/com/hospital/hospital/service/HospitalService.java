package com.hospital.hospital.service;

import java.util.List;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.hospital.domain.Department;
import com.hospital.hospital.domain.DepartmentRepository;
import com.hospital.hospital.domain.Hospital;
import com.hospital.hospital.domain.HospitalRepository;
import com.hospital.hospital.dto.HospitalDtos.*;

import lombok.extern.log4j.Log4j2;

/** Hospital + department master data. Reads are cached in Redis; every write updates/evicts the affected entries. */
@Log4j2
@Service
public class HospitalService {
    private final HospitalRepository hospitals;
    private final DepartmentRepository departments;

    public HospitalService(HospitalRepository hospitals, DepartmentRepository departments) {
        this.hospitals = hospitals;
        this.departments = departments;
    }

    @Transactional
    public HospitalResponse create(HospitalRequest r) {
        if (hospitals.existsByCode(r.getCode())) throw new ConflictException("Hospital code '" + r.getCode() + "' already exists");
        Hospital h = new Hospital();
        apply(h, r);
        return HospitalResponse.from(hospitals.save(h));
    }

    @Transactional(readOnly = true)
    public List<HospitalResponse> list() {
        return hospitals.findAll().stream().map(HospitalResponse::from).toList();
    }

    @Cacheable(cacheNames = "hospitals", key = "#id")
    @Transactional(readOnly = true)
    public HospitalResponse get(Long id) {
        log.debug("Loading hospital {} from database (cache miss)", id);
        return HospitalResponse.from(find(id));
    }

    @CachePut(cacheNames = "hospitals", key = "#id")
    @Transactional
    public HospitalResponse update(Long id, HospitalRequest r) {
        Hospital h = find(id);
        if (!h.getCode().equals(r.getCode()) && hospitals.existsByCode(r.getCode())) {
            throw new ConflictException("Hospital code '" + r.getCode() + "' already exists");
        }
        apply(h, r);
        return HospitalResponse.from(h);
    }

    @CacheEvict(cacheNames = "hospitals", key = "#id")
    @Transactional
    public void deactivate(Long id) {
        find(id).setActive(false);
    }

    @Cacheable(cacheNames = "hospitalDepartments", key = "#hospitalId")
    @Transactional(readOnly = true)
    public List<DepartmentResponse> departments(Long hospitalId) {
        find(hospitalId);
        return departments.findByHospitalIdOrderByName(hospitalId).stream().map(DepartmentResponse::from).toList();
    }

    @CacheEvict(cacheNames = "hospitalDepartments", key = "#hospitalId")
    @Transactional
    public DepartmentResponse addDepartment(Long hospitalId, DepartmentRequest r) {
        Hospital h = find(hospitalId);
        if (departments.existsByHospitalIdAndNameIgnoreCase(hospitalId, r.getName())) {
            throw new ConflictException("Department '" + r.getName() + "' already exists in this hospital");
        }
        Department d = new Department();
        d.setHospital(h);
        d.setName(r.getName());
        d.setDescription(r.getDescription());
        return DepartmentResponse.from(departments.save(d));
    }

    @Transactional(readOnly = true)
    public DepartmentResponse department(Long id) {
        return DepartmentResponse.from(departments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Department " + id + " not found")));
    }

    @Caching(evict = @CacheEvict(cacheNames = "hospitalDepartments", allEntries = true))
    @Transactional
    public DepartmentResponse updateDepartment(Long id, DepartmentRequest r) {
        Department d = departments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Department " + id + " not found"));
        d.setName(r.getName());
        d.setDescription(r.getDescription());
        return DepartmentResponse.from(d);
    }

    @CacheEvict(cacheNames = "hospitalDepartments", allEntries = true)
    @Transactional
    public void deactivateDepartment(Long id) {
        departments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Department " + id + " not found")).setActive(false);
    }

    private Hospital find(Long id) {
        return hospitals.findById(id).orElseThrow(() -> new ResourceNotFoundException("Hospital " + id + " not found"));
    }

    private static void apply(Hospital h, HospitalRequest r) {
        h.setName(r.getName());
        h.setCode(r.getCode());
        h.setAddress(r.getAddress());
        h.setCity(r.getCity());
        h.setPhone(r.getPhone());
        h.setEmail(r.getEmail());
    }
}
