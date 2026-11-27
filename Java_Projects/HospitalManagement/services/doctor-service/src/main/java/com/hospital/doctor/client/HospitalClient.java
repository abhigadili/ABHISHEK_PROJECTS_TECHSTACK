package com.hospital.doctor.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import lombok.Data;

/** OpenFeign client: Doctor Service -> Hospital Service (validate hospital/department references). */
@FeignClient(name = "hospital-service", url = "${hospital.services.hospital.url}")
public interface HospitalClient {

    @GetMapping("/api/hospitals/{id}")
    HospitalView hospital(@PathVariable("id") Long id);

    @GetMapping("/api/departments/{id}")
    DepartmentView department(@PathVariable("id") Long id);

    @Data
    class HospitalView {
        private Long id;
        private String name;
        private boolean active;
    }

    @Data
    class DepartmentView {
        private Long id;
        private Long hospitalId;
        private String name;
        private boolean active;
    }
}
