package com.hospital.pharmacy.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Data;

/** OpenFeign client: Pharmacy Service -> Prescription Service. */
@FeignClient(name = "prescription-service", url = "${hospital.services.prescription.url}")
public interface PrescriptionClient {

    @GetMapping("/api/prescriptions/{id}/status")
    PrescriptionStatusView status(@PathVariable("id") Long id);

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    class PrescriptionStatusView {
        private Long id;
        private String status;
    }
}
