package com.hospital.common.client;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.hospital.common.web.ServiceUnavailableException;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.extern.log4j.Log4j2;

/** Resilience4j-protected non-blocking WebClient access to the Doctor Service (blocked with a timeout at the edge of each call). */
@Log4j2
@Component
@ConditionalOnProperty(name = "hospital.clients.doctor.enabled", havingValue = "true")
public class DoctorGateway {
    private final WebClient client;
    private final WebClientFactory factory;
    private final Map<Long, DoctorView> lastKnown = new ConcurrentHashMap<>();

    public DoctorGateway(WebClientFactory factory, @Value("${hospital.services.doctor.url}") String baseUrl) {
        this.factory = factory;
        this.client = factory.create("doctor-service", baseUrl);
    }

    @CircuitBreaker(name = "doctorService", fallbackMethod = "doctorFallback")
    public DoctorView doctor(Long doctorId) {
        DoctorView d = Downstream.call("doctor-service", () -> client.get().uri("/api/doctors/{id}", doctorId)
                .retrieve().bodyToMono(DoctorView.class).block(factory.blockTimeout()));
        lastKnown.put(doctorId, d);
        return d;
    }

    /** Slot grid generated from the doctor's weekly schedule / days off (availability is merged by the caller). */
    @CircuitBreaker(name = "doctorService", fallbackMethod = "slotsFallback")
    public List<SlotView> slots(Long doctorId, LocalDate date) {
        return Downstream.call("doctor-service", () -> client.get()
                .uri(u -> u.path("/api/doctors/{id}/slots").queryParam("date", date).build(doctorId))
                .retrieve().bodyToMono(new ParameterizedTypeReference<List<SlotView>>() {}).block(factory.blockTimeout()));
    }

    DoctorView doctorFallback(Long id, ServiceUnavailableException ex) {
        return degraded(id, ex);
    }

    DoctorView doctorFallback(Long id, CallNotPermittedException ex) {
        return degraded(id, ex);
    }

    List<SlotView> slotsFallback(Long id, LocalDate date, ServiceUnavailableException ex) {
        throw new ServiceUnavailableException("Doctor schedule is temporarily unavailable, please try again shortly");
    }

    List<SlotView> slotsFallback(Long id, LocalDate date, CallNotPermittedException ex) {
        throw new ServiceUnavailableException("Doctor service circuit is open, schedule unavailable");
    }

    private DoctorView degraded(Long id, Exception ex) {
        DoctorView cached = lastKnown.get(id);
        if (cached != null) {
            log.warn("Doctor service unavailable ({}); serving last-known doctor {}", ex.getClass().getSimpleName(), id);
            return cached;
        }
        throw new ServiceUnavailableException("Doctor service unavailable and no previously validated data for doctor " + id);
    }

}
