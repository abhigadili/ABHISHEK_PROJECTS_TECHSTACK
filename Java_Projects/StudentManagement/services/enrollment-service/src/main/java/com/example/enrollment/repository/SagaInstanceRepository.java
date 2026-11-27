package com.example.enrollment.repository;

import com.example.enrollment.entity.SagaInstance;
import com.example.enrollment.entity.SagaState;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SagaInstanceRepository extends JpaRepository<SagaInstance, Long> {
    Optional<SagaInstance> findByIdempotencyKey(String key);
    List<SagaInstance> findTop50ByStateNotInAndUpdatedAtBeforeOrderByUpdatedAt(Collection<SagaState> terminal, LocalDateTime before);
    long countByState(SagaState state);
}
