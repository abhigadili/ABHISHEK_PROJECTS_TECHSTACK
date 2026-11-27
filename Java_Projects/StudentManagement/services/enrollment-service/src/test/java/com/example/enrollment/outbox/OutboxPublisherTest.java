package com.example.enrollment.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.example.enrollment.entity.OutboxEvent;
import com.example.enrollment.entity.OutboxStatus;
import com.example.enrollment.repository.OutboxEventRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OutboxPublisherTest {
    @Mock OutboxEventRepository repository;
    @Mock KafkaTemplate<String, String> kafka;
    @Mock TransactionTemplate tx;
    OutboxPublisher publisher;

    @BeforeEach
    void setUp() { publisher = new OutboxPublisher(repository, kafka, tx, new SimpleMeterRegistry(), 50, 1); }

    private static OutboxEvent event(long id, long aggregate) {
        OutboxEvent e = new OutboxEvent();
        e.setOutboxId(id); e.setAggregateId(aggregate); e.setEventId("evt-" + id); e.setEventType("EnrollmentConfirmed");
        e.setTopic("enrollment.confirmed"); e.setEventKey(String.valueOf(aggregate)); e.setPayload("{}");
        return e;
    }

    private static CompletableFuture<SendResult<String, String>> ok() {
        return CompletableFuture.completedFuture(new SendResult<>(new ProducerRecord<>("t", "k", "v"),
                new RecordMetadata(new TopicPartition("t", 0), 0, 0, 0, 0, 0)));
    }

    @Test
    void successfulSendMarksEventPublished() {
        OutboxEvent e = event(1, 100);
        when(repository.lockDue(any(), any(), any())).thenReturn(List.of(e));
        when(kafka.send(any(ProducerRecord.class))).thenReturn(ok());

        assertThat(publisher.publishBatch()).isEqualTo(1);

        assertThat(e.getStatus()).isEqualTo(OutboxStatus.PUBLISHED);
        assertThat(e.getPublishedAt()).isNotNull();
        verify(repository).saveAll(List.of(e));
    }

    @Test
    void failedSendKeepsEventPendingWithBackoffInsteadOfLosingIt() {
        OutboxEvent e = event(1, 100);
        when(repository.lockDue(any(), any(), any())).thenReturn(List.of(e));
        when(kafka.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.failedFuture(new RuntimeException("broker down")));

        assertThat(publisher.publishBatch()).isZero();

        assertThat(e.getStatus()).isEqualTo(OutboxStatus.PENDING);
        assertThat(e.getAttempts()).isEqualTo(1);
        assertThat(e.getLastError()).contains("broker down");
        assertThat(e.getNextAttemptAt()).isAfter(LocalDateTime.now());
    }

    @Test
    void afterAFailureLaterEventsOfTheSameEnrollmentAreSkippedToPreserveOrdering() {
        OutboxEvent requested = event(1, 100), confirmed = event(2, 100), other = event(3, 200);
        when(repository.lockDue(any(), any(), any())).thenReturn(List.of(requested, confirmed, other));
        when(kafka.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.failedFuture(new RuntimeException("boom")), ok());

        assertThat(publisher.publishBatch()).isEqualTo(1);

        assertThat(requested.getAttempts()).isEqualTo(1);
        assertThat(confirmed.getAttempts()).isZero();                       // never attempted: would overtake `requested`
        assertThat(confirmed.getStatus()).isEqualTo(OutboxStatus.PENDING);
        assertThat(other.getStatus()).isEqualTo(OutboxStatus.PUBLISHED);   // other aggregates are unaffected
        verify(kafka, times(2)).send(any(ProducerRecord.class));
    }

    @Test
    void backoffGrowsAndIsCappedAtOneMinute() {
        OutboxEvent e = event(1, 100);
        e.setAttempts(20);
        when(repository.lockDue(any(), any(), any())).thenReturn(List.of(e));
        when(kafka.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.failedFuture(new RuntimeException("x")));

        publisher.publishBatch();

        assertThat(e.getNextAttemptAt()).isBefore(LocalDateTime.now().plusSeconds(61));
        assertThat(e.getStatus()).isEqualTo(OutboxStatus.PENDING);
    }
}
