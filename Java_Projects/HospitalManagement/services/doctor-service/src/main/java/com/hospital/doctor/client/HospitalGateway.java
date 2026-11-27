package com.hospital.doctor.client;

import org.springframework.stereotype.Component;

import com.hospital.common.client.Downstream;
import com.hospital.common.web.BadRequestException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.common.web.ServiceUnavailableException;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

/**
 * Circuit-breaker protected use of the Feign {@link HospitalClient}. Validation of a *reference* must not be
 * silently skipped, so the fallback fails fast with 503 (the caller can retry) instead of accepting unverified ids.
 */
@Component
public class HospitalGateway {
    private final HospitalClient client;

    public HospitalGateway(HospitalClient client) {
        this.client = client;
    }

    @CircuitBreaker(name = "hospitalService", fallbackMethod = "unavailable")
    public void validate(Long hospitalId, Long departmentId) {
        HospitalClient.HospitalView h;
        try {
            h = Downstream.call("hospital-service", () -> client.hospital(hospitalId));
        } catch (ResourceNotFoundException e) {
            throw new BadRequestException("Hospital " + hospitalId + " does not exist");
        }
        if (!h.isActive()) throw new BadRequestException("Hospital " + hospitalId + " is not active");
        if (departmentId != null) {
            HospitalClient.DepartmentView d;
            try {
                d = Downstream.call("hospital-service", () -> client.department(departmentId));
            } catch (ResourceNotFoundException e) {
                throw new BadRequestException("Department " + departmentId + " does not exist");
            }
            if (!d.isActive() || !hospitalId.equals(d.getHospitalId())) {
                throw new BadRequestException("Department " + departmentId + " is not an active department of hospital " + hospitalId);
            }
        }
    }

    void unavailable(Long hospitalId, Long departmentId, ServiceUnavailableException ex) {
        throw new ServiceUnavailableException("Hospital service is unavailable - cannot verify hospital/department right now");
    }

    void unavailable(Long hospitalId, Long departmentId, CallNotPermittedException ex) {
        throw new ServiceUnavailableException("Hospital service circuit is open - cannot verify hospital/department right now");
    }
}
