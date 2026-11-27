package com.example.enrollment.saga;

import com.example.enrollment.entity.SagaInstance;
import com.example.enrollment.entity.SagaState;
import com.example.enrollment.repository.SagaInstanceRepository;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Resumes sagas that stopped making progress (service restart, dependency outage) from their persisted state. */
@Component
public class SagaRecoveryJob {
    private static final Logger log = LoggerFactory.getLogger(SagaRecoveryJob.class);
    private final SagaInstanceRepository sagas;
    private final EnrollmentSagaOrchestrator orchestrator;
    private final long staleAfterSeconds;

    public SagaRecoveryJob(SagaInstanceRepository sagas, EnrollmentSagaOrchestrator orchestrator,
                           @Value("${enrollment.saga.stale-after-seconds:30}") long staleAfterSeconds) {
        this.sagas = sagas; this.orchestrator = orchestrator; this.staleAfterSeconds = staleAfterSeconds;
    }

    @Scheduled(fixedDelayString = "${enrollment.saga.recovery-interval-ms:15000}", initialDelayString = "${enrollment.saga.recovery-interval-ms:15000}")
    public void recover() {
        List<SagaInstance> stuck = sagas.findTop50ByStateNotInAndUpdatedAtBeforeOrderByUpdatedAt(
                EnumSet.of(SagaState.COMPLETED, SagaState.REJECTED), LocalDateTime.now().minusSeconds(staleAfterSeconds));
        for (SagaInstance s : stuck) {
            try {
                log.warn("Recovering saga {} stuck in {} since {}", s.getSagaId(), s.getState(), s.getUpdatedAt());
                orchestrator.run(s.getSagaId());
            } catch (OptimisticLockingFailureException e) {
                log.info("Saga {} is being handled by another worker", s.getSagaId());
            } catch (RuntimeException e) {
                log.error("Recovery of saga {} failed: {}", s.getSagaId(), e.toString());
            }
        }
    }
}
