package com.hospital.pharmacy.client;

import org.springframework.stereotype.Component;

import com.hospital.common.client.Downstream;
import com.hospital.common.web.ServiceUnavailableException;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

/** Dispensing must not proceed on an unverified prescription, so the fallback fails fast with 503. */
@Component
public class PrescriptionGateway {
    private final PrescriptionClient client;

    public PrescriptionGateway(PrescriptionClient client) {
        this.client = client;
    }

    @CircuitBreaker(name = "prescriptionService", fallbackMethod = "unavailable")
    public PrescriptionClient.PrescriptionStatusView status(Long prescriptionId) {
        return Downstream.call("prescription-service", () -> client.status(prescriptionId));
    }

    PrescriptionClient.PrescriptionStatusView unavailable(Long id, ServiceUnavailableException ex) {
        throw new ServiceUnavailableException("Prescription service is unavailable - cannot verify prescription " + id + " right now");
    }

    PrescriptionClient.PrescriptionStatusView unavailable(Long id, CallNotPermittedException ex) {
        throw new ServiceUnavailableException("Prescription service circuit is open - cannot verify prescription " + id + " right now");
    }
}
