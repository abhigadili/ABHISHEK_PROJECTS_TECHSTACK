package com.example.enrollment.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

import com.example.common.exception.ConflictException;
import com.example.enrollment.client.CourseGateway;
import com.example.enrollment.client.RemoteDtos.*;
import com.example.enrollment.client.RemoteExceptions.RemoteConflictException;
import com.example.enrollment.client.StudentGateway;
import com.example.enrollment.command.*;
import com.example.enrollment.entity.*;
import com.example.enrollment.event.EnrollmentEventRecorder;
import com.example.enrollment.query.EnrollmentQueries.*;
import com.example.enrollment.query.EnrollmentQueryHandlers;
import com.example.enrollment.repository.EnrollmentRepository;
import com.example.enrollment.repository.SagaInstanceRepository;
import com.example.enrollment.saga.SagaRecoveryJob;
import com.example.events.EnrollmentEvent;
import com.example.events.EnrollmentEventType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EnrollmentFlowIT extends AbstractIT {
    private static final AtomicLong IDS = new AtomicLong(1000);   // unique student/course ids per test

    @Autowired CreateEnrollmentCommandHandler create;
    @Autowired CancelEnrollmentCommandHandler cancel;
    @Autowired EnrollmentQueryHandlers queries;
    @Autowired EnrollmentRepository enrollments;
    @Autowired SagaInstanceRepository sagas;
    @Autowired SagaRecoveryJob recovery;
    @Autowired EnrollmentEventRecorder recorder;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean StudentGateway students;
    @MockitoBean CourseGateway courses;

    @BeforeEach
    void stubHealthyDependencies() {
        when(students.eligibility(anyLong())).thenAnswer(i -> CompletableFuture.completedFuture(new EligibilityInfo(i.getArgument(0), true, null)));
        when(students.getStudent(anyLong())).thenAnswer(i -> CompletableFuture.completedFuture(new StudentInfo(i.getArgument(0), "Asha", "Rao", "asha@example.com", "ACTIVE")));
        when(courses.getCourse(anyLong())).thenAnswer(i -> CompletableFuture.completedFuture(new CourseInfo(i.getArgument(0), "Java", "JMS", "ACTIVE", 10, 5)));
        when(courses.availability(anyLong())).thenAnswer(i -> CompletableFuture.completedFuture(new AvailabilityInfo(i.getArgument(0), "ACTIVE", 10, 5, true)));
        when(courses.reserveSeat(anyLong(), anyLong())).thenAnswer(i -> CompletableFuture.completedFuture(new SeatResult(i.getArgument(0), i.getArgument(1), "RESERVED", 4, false)));
        when(courses.releaseSeat(anyLong(), anyLong())).thenAnswer(i -> CompletableFuture.completedFuture(new SeatResult(i.getArgument(0), i.getArgument(1), "RELEASED", 5, false)));
    }

    private static String key() { return "it-" + UUID.randomUUID(); }

    private EnrollmentOutcome enroll(long student, long course, String key) { return create.handle(new CreateEnrollmentCommand(student, course, key, "corr-it")); }

    private List<String> outboxTypes(long enrollmentId) {
        return jdbc.queryForList("select event_type from sms_outbox_events where aggregate_id=? order by outbox_id", String.class, enrollmentId);
    }

    private static <T> T await(Supplier<T> supplier, java.util.function.Predicate<T> done, Duration timeout) throws InterruptedException {
        long end = System.currentTimeMillis() + timeout.toMillis();
        T v = supplier.get();
        while (!done.test(v) && System.currentTimeMillis() < end) { Thread.sleep(300); v = supplier.get(); }
        return v;
    }

    private List<EnrollmentEvent> consume(String topic, long enrollmentId, int expectedAtLeast) throws Exception {
        Properties p = new Properties();
        p.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers());
        p.put(ConsumerConfig.GROUP_ID_CONFIG, "it-" + UUID.randomUUID());
        p.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        p.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        p.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        ObjectMapper om = new ObjectMapper().registerModule(new JavaTimeModule());
        List<EnrollmentEvent> found = new ArrayList<>();
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(p)) {
            consumer.subscribe(List.of(topic));
            long end = System.currentTimeMillis() + 40_000;
            while (found.size() < expectedAtLeast && System.currentTimeMillis() < end) {
                for (var r : consumer.poll(Duration.ofMillis(500))) {
                    EnrollmentEvent e = om.readValue(r.value(), EnrollmentEvent.class);
                    if (e.enrollmentId().equals(enrollmentId)) found.add(e);
                }
            }
        }
        return found;
    }

    @Order(1)
    @Test
    void successfulEnrollmentIsConfirmedAndEventsReachKafkaThroughTheOutbox() throws Exception {
        long student = IDS.incrementAndGet(), course = IDS.incrementAndGet();

        EnrollmentOutcome out = enroll(student, course, key());

        assertThat(out.result()).isEqualTo("CONFIRMED");
        long id = out.enrollment().enrollmentId();
        assertThat(enrollments.findById(id).orElseThrow().getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
        assertThat(outboxTypes(id)).containsExactly("EnrollmentRequested", "EnrollmentConfirmed");
        assertThat(jdbc.queryForObject("select state from sms_saga_instances where enrollment_id=?", String.class, id)).isEqualTo("COMPLETED");

        String pending = "select count(*) from sms_outbox_events where aggregate_id=? and status='PENDING'";
        assertThat(await(() -> jdbc.queryForObject(pending, Integer.class, id), n -> n == 0, Duration.ofSeconds(30))).as("background publisher drained the outbox").isZero();

        List<EnrollmentEvent> confirmed = consume("enrollment.confirmed", id, 1);
        List<EnrollmentEvent> requested = consume("enrollment.requested", id, 1);
        assertThat(confirmed).hasSize(1);
        assertThat(confirmed.get(0).eventType()).isEqualTo(EnrollmentEventType.EnrollmentConfirmed);
        assertThat(confirmed.get(0).studentId()).isEqualTo(student);
        assertThat(confirmed.get(0).studentEmail()).isEqualTo("asha@example.com");
        assertThat(confirmed.get(0).courseName()).isEqualTo("Java");
        assertThat(confirmed.get(0).correlationId()).isEqualTo("corr-it");
        assertThat(requested).hasSize(1);
    }

    @Order(2)
    @Test
    void sameIdempotencyKeyNeverCreatesASecondEnrollmentOrReservesASecondSeat() {
        long student = IDS.incrementAndGet(), course = IDS.incrementAndGet();
        String k = key();

        EnrollmentOutcome first = enroll(student, course, k);
        EnrollmentOutcome replay = enroll(student, course, k);

        assertThat(replay.enrollment().enrollmentId()).isEqualTo(first.enrollment().enrollmentId());
        assertThat(replay.result()).isEqualTo("CONFIRMED");
        assertThat(jdbc.queryForObject("select count(*) from sms_enrollments where idempotency_key=?", Integer.class, k)).isEqualTo(1);
        assertThat(outboxTypes(first.enrollment().enrollmentId())).hasSize(2);
        verify(courses, times(1)).reserveSeat(anyLong(), anyLong());
    }

    @Order(3)
    @Test
    void duplicateActiveEnrollmentIsBlockedByTheApplicationAndByTheDatabaseConstraint() {
        long student = IDS.incrementAndGet(), course = IDS.incrementAndGet();
        enroll(student, course, key());

        assertThatThrownBy(() -> enroll(student, course, key())).isInstanceOf(ConflictException.class);

        Enrollment raw = new Enrollment();
        raw.setStudentId(student); raw.setCourseId(course); raw.setStatus(EnrollmentStatus.PENDING); raw.setIdempotencyKey(key());
        assertThatThrownBy(() -> enrollments.saveAndFlush(raw)).isInstanceOf(DataIntegrityViolationException.class);   // generated-column unique key
    }

    @Order(4)
    @Test
    void afterCancellationTheStudentMayEnrollAgain() {
        long student = IDS.incrementAndGet(), course = IDS.incrementAndGet();
        long id = enroll(student, course, key()).enrollment().enrollmentId();

        var cancelled = cancel.handle(new CancelEnrollmentCommand(id, "it"));

        assertThat(cancelled.enrollmentStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
        verify(courses).releaseSeat(course, id);
        assertThat(outboxTypes(id)).containsExactly("EnrollmentRequested", "EnrollmentConfirmed", "EnrollmentCancelled");
        assertThat(enroll(student, course, key()).result()).isEqualTo("CONFIRMED");   // CANCELLED rows have no active_key
    }

    @Order(5)
    @Test
    void seatShortageRejectsTheEnrollmentCompensatesAndPublishesRejected() {
        long student = IDS.incrementAndGet(), course = IDS.incrementAndGet();
        when(courses.reserveSeat(anyLong(), anyLong())).thenReturn(CompletableFuture.failedFuture(new RemoteConflictException("409")));

        EnrollmentOutcome out = enroll(student, course, key());

        assertThat(out.result()).isEqualTo("REJECTED");
        long id = out.enrollment().enrollmentId();
        assertThat(out.enrollment().enrollmentStatus()).isEqualTo(EnrollmentStatus.REJECTED);
        verify(courses).releaseSeat(course, id);
        assertThat(outboxTypes(id)).containsExactly("EnrollmentRequested", "EnrollmentRejected");
        assertThat(enroll(student, course, key()).result()).as("a REJECTED row does not block a retry").isEqualTo("REJECTED");
    }

    @Order(6)
    @Test
    void businessChangeAndOutboxEventCommitOrRollBackTogether() {
        String k = key();
        assertThatThrownBy(() -> tx.executeWithoutResult(s -> {
            Enrollment e = new Enrollment();
            e.setStudentId(IDS.incrementAndGet()); e.setCourseId(IDS.incrementAndGet()); e.setStatus(EnrollmentStatus.CONFIRMED); e.setIdempotencyKey(k);
            e = enrollments.saveAndFlush(e);
            recorder.record(EnrollmentEventType.EnrollmentConfirmed, e, null, null);
            throw new IllegalStateException("crash before commit");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(jdbc.queryForObject("select count(*) from sms_enrollments where idempotency_key=?", Integer.class, k)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from sms_outbox_events where payload like ?", Integer.class, "%" + k + "%")).isZero();
        assertThatThrownBy(() -> recorder.record(EnrollmentEventType.EnrollmentConfirmed, new Enrollment(), null, null))
                .as("outbox can only be written inside a transaction").isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
    }

    @Order(7)
    @Test
    void sagaInterruptedByACrashIsResumedFromItsPersistedStateByTheRecoveryJob() {
        long student = IDS.incrementAndGet(), course = IDS.incrementAndGet();
        String k = key();
        // state left behind by a service that died right after step 4 (PENDING enrollment created, seat not yet reserved)
        Enrollment pending = new Enrollment();
        pending.setStudentId(student); pending.setCourseId(course); pending.setStatus(EnrollmentStatus.PENDING); pending.setIdempotencyKey(k);
        pending.setStudentName("Asha Rao"); pending.setStudentEmail("asha@example.com"); pending.setCourseName("Java");
        Enrollment saved = enrollments.saveAndFlush(pending);
        SagaInstance saga = new SagaInstance();
        saga.setIdempotencyKey(k); saga.setStudentId(student); saga.setCourseId(course); saga.setEnrollmentId(saved.getEnrollmentId()); saga.setState(SagaState.PENDING_CREATED);
        saga = sagas.saveAndFlush(saga);
        jdbc.update("update sms_saga_instances set updated_at = now() - interval 10 minute where saga_id=?", saga.getSagaId());

        recovery.recover();

        assertThat(sagas.findById(saga.getSagaId()).orElseThrow().getState()).isEqualTo(SagaState.COMPLETED);
        assertThat(enrollments.findById(saved.getEnrollmentId()).orElseThrow().getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
        verify(courses).reserveSeat(course, saved.getEnrollmentId());
        verify(students, never()).eligibility(anyLong());   // earlier steps are not repeated
        assertThat(outboxTypes(saved.getEnrollmentId())).contains("EnrollmentConfirmed");
    }

    @Order(8)
    @Test
    void queriesProvideHistoryCourseViewSearchAndPaging() {
        long student = IDS.incrementAndGet(), course = IDS.incrementAndGet();
        for (int i = 0; i < 3; i++) enroll(student, IDS.incrementAndGet(), key());
        long cancelledId = enroll(student, course, key()).enrollment().enrollmentId();
        cancel.handle(new CancelEnrollmentCommand(cancelledId, null));

        var history = queries.handle(new StudentEnrollmentHistoryQuery(student, PageRequest.of(0, 3, org.springframework.data.domain.Sort.by("enrollmentId").descending())));
        assertThat(history.getTotalElements()).isEqualTo(4);
        assertThat(history.getContent()).hasSize(3);
        assertThat(queries.handle(new SearchEnrollmentsQuery(student, null, EnrollmentStatus.CANCELLED, null, null, PageRequest.of(0, 10))).getContent())
                .extracting(r -> r.enrollmentId()).containsExactly(cancelledId);
        assertThat(queries.handle(new CourseEnrollmentsQuery(course, null, PageRequest.of(0, 10))).getTotalElements()).isEqualTo(1);
        assertThat(queries.handle(new GetEnrollmentQuery(cancelledId)).studentId()).isEqualTo(student);
    }

    /** Runs last: pauses the broker, so events must stay in the outbox and be delivered after it comes back. */
    @Order(99)
    @Test
    void outboxKeepsEventsDuringAKafkaOutageAndDeliversThemAfterwards() throws Exception {
        long student = IDS.incrementAndGet(), course = IDS.incrementAndGet();
        var docker = KAFKA.getDockerClient();
        docker.pauseContainerCmd(KAFKA.getContainerId()).exec();
        long id;
        try {
            EnrollmentOutcome out = enroll(student, course, key());     // business transaction does not depend on Kafka
            assertThat(out.result()).isEqualTo("CONFIRMED");
            id = out.enrollment().enrollmentId();

            String failing = "select count(*) from sms_outbox_events where aggregate_id=? and status='PENDING' and attempts>0";
            assertThat(await(() -> jdbc.queryForObject(failing, Integer.class, id), n -> n > 0, Duration.ofSeconds(60)))
                    .as("publishing was attempted, failed and recorded for retry").isPositive();
            assertThat(jdbc.queryForObject("select count(*) from sms_outbox_events where aggregate_id=? and status='PUBLISHED'", Integer.class, id)).isZero();
        } finally {
            docker.unpauseContainerCmd(KAFKA.getContainerId()).exec();
        }

        String pending = "select count(*) from sms_outbox_events where aggregate_id=? and status='PENDING'";
        assertThat(await(() -> jdbc.queryForObject(pending, Integer.class, id), n -> n == 0, Duration.ofSeconds(120))).as("all events delivered after recovery").isZero();
        assertThat(consume("enrollment.confirmed", id, 1)).isNotEmpty();          // at-least-once: duplicates are possible, loss is not
        assertThat(consume("enrollment.requested", id, 1)).isNotEmpty();
    }
}
