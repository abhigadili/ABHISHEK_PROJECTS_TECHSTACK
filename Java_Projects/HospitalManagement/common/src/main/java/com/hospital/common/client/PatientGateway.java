package com.hospital.common.client;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.hospital.common.security.CurrentUser;
import com.hospital.common.security.Role;
import com.hospital.common.web.ForbiddenOperationException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.common.web.ServiceUnavailableException;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.extern.log4j.Log4j2;

/**
 * Resilience4j-protected wrapper around the Feign {@link PatientClient}.
 * Fallback strategy: if the Patient Service is down or the circuit is open we serve the last
 * successfully fetched summary (patients rarely change identity) so booking/billing reads degrade
 * gracefully; with no cached value the caller gets a clean 503.
 */
@Log4j2
@Component
@ConditionalOnProperty(name = "hospital.clients.patient.enabled", havingValue = "true")
public class PatientGateway {
    private final PatientClient client;
    private final Map<Long, PatientSummary> lastKnown = new ConcurrentHashMap<>();

    public PatientGateway(PatientClient client) {
        this.client = client;
    }

    @CircuitBreaker(name = "patientService", fallbackMethod = "summaryFallback")
    public PatientSummary summary(Long patientId) {
        return fetch(patientId);
    }

    private PatientSummary fetch(Long patientId) {
        PatientSummary s = Downstream.call("patient-service", () -> client.summary(patientId));
        lastKnown.put(patientId, s);
        return s;
    }

    @CircuitBreaker(name = "patientService", fallbackMethod = "byUserFallback")
    public PatientSummary byUser(Long userId) {
        PatientSummary s = Downstream.call("patient-service", () -> client.byUser(userId));
        lastKnown.put(s.getId(), s);
        return s;
    }

    PatientSummary summaryFallback(Long id, ServiceUnavailableException ex) {
        return degraded(id, ex);
    }

    PatientSummary summaryFallback(Long id, CallNotPermittedException ex) {
        return degraded(id, ex);
    }

    PatientSummary byUserFallback(Long userId, ServiceUnavailableException ex) {
        throw new ServiceUnavailableException("Patient service unavailable, cannot resolve the patient profile right now");
    }

    PatientSummary byUserFallback(Long userId, CallNotPermittedException ex) {
        throw new ServiceUnavailableException("Patient service circuit is open, cannot resolve the patient profile right now");
    }

    private PatientSummary degraded(Long id, Exception ex) {
        PatientSummary cached = lastKnown.get(id);
        if (cached != null) {
            log.warn("Patient service unavailable ({}); serving last-known summary for patient {}", ex.getClass().getSimpleName(), id);
            return cached;
        }
        throw new ServiceUnavailableException("Patient service unavailable and no previously validated data for patient " + id);
    }

    /** Patient-owned data may be read by staff roles, or by the patient it belongs to.
     *  Own @CircuitBreaker entry point: a self-invocation of summary() would bypass the proxy. */
    @CircuitBreaker(name = "patientService", fallbackMethod = "requireAccessFallback")
    public PatientSummary requireAccess(Long patientId) {
        return assertAccess(fetch(patientId));
    }

    PatientSummary requireAccessFallback(Long id, ServiceUnavailableException ex) {
        return assertAccess(degraded(id, ex));
    }

    PatientSummary requireAccessFallback(Long id, CallNotPermittedException ex) {
        return assertAccess(degraded(id, ex));
    }

    private PatientSummary assertAccess(PatientSummary s) {
        if (s == null) throw new ResourceNotFoundException("Patient not found");
        if (CurrentUser.hasRole(Role.PATIENT) && !CurrentUser.isAdmin()) {
            Long uid = CurrentUser.id();
            if (uid == null || !uid.equals(s.getUserId())) {
                throw new ForbiddenOperationException("Patients may only access their own data");
            }
        }
        return s;
    }
}
