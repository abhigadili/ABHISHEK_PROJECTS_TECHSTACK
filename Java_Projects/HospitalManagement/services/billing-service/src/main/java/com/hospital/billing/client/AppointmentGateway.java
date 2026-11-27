package com.hospital.billing.client;

import java.math.BigDecimal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hospital.common.client.Downstream;
import com.hospital.common.client.WebClientFactory;
import com.hospital.common.web.ServiceUnavailableException;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.Data;

/** WebClient access to the Appointment Service, used to verify that a manually raised APPOINTMENT bill refers to a real appointment of that patient. */
@Component
public class AppointmentGateway {
    private final WebClient client;
    private final WebClientFactory factory;

    public AppointmentGateway(WebClientFactory factory, @Value("${hospital.services.appointment.url}") String baseUrl) {
        this.factory = factory;
        this.client = factory.create("appointment-service", baseUrl);
    }

    @CircuitBreaker(name = "appointmentService", fallbackMethod = "unavailable")
    public AppointmentView appointment(Long id) {
        return Downstream.call("appointment-service", () -> client.get().uri("/api/appointments/{id}", id)
                .retrieve().bodyToMono(AppointmentView.class).block(factory.blockTimeout()));
    }

    AppointmentView unavailable(Long id, ServiceUnavailableException ex) {
        throw new ServiceUnavailableException("Appointment service is unavailable - cannot verify appointment " + id + " right now");
    }

    AppointmentView unavailable(Long id, CallNotPermittedException ex) {
        throw new ServiceUnavailableException("Appointment service circuit is open - cannot verify appointment " + id + " right now");
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AppointmentView {
        private Long id;
        private Long patientId;
        private String status;
        private BigDecimal fee;
    }
}
