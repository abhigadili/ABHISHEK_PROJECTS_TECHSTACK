package com.hospital.common.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/** OpenFeign client for the Patient Service (declarative REST). */
@FeignClient(name = "patient-service", url = "${hospital.services.patient.url}")
public interface PatientClient {

    @GetMapping("/api/patients/{id}/summary")
    PatientSummary summary(@PathVariable("id") Long id);

    @GetMapping("/api/patients/by-user/{userId}")
    PatientSummary byUser(@PathVariable("userId") Long userId);
}
