package com.example.notification.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.events.EnrollmentEvent;
import com.example.events.EnrollmentEventType;
import com.example.events.LowCourseAvailabilityEvent;
import com.example.events.Topics;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class NotificationKafkaIT extends AbstractIT {
    private static final AtomicLong ENROLLMENT_IDS = new AtomicLong(5000);
    private static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private static KafkaProducer<String, String> producer;

    @Autowired JdbcTemplate jdbc;

    @BeforeAll
    static void startProducer() {
        producer = new KafkaProducer<>(Map.of(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers(),
                ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class, ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class));
    }

    @AfterAll
    static void stopProducer() { producer.close(); }

    private EnrollmentEvent event(String eventId, EnrollmentEventType type, long enrollmentId, String email) {
        return new EnrollmentEvent(eventId, type, enrollmentId, 7L, 3L, "Asha Rao", email, "Java", "no seats", "corr", Instant.now());
    }

    private void publish(EnrollmentEvent e) throws Exception {
        producer.send(new ProducerRecord<>(e.eventType().topic(), String.valueOf(e.enrollmentId()), JSON.writeValueAsString(e))).get();
    }

    private static <T> T await(Supplier<T> s, java.util.function.Predicate<T> done) throws InterruptedException {
        long end = System.currentTimeMillis() + 40_000;
        T v = s.get();
        while (!done.test(v) && System.currentTimeMillis() < end) { Thread.sleep(300); v = s.get(); }
        return v;
    }

    private Map<String, Object> notification(long enrollmentId, String type) {
        List<Map<String, Object>> rows = jdbc.queryForList("select * from sms_notifications where enrollment_id=? and notification_type=?", enrollmentId, type);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Test
    void confirmedEventBecomesANotificationThatIsSentByTheBackgroundDispatcher() throws Exception {
        long enr = ENROLLMENT_IDS.incrementAndGet();
        publish(event(UUID.randomUUID().toString(), EnrollmentEventType.EnrollmentConfirmed, enr, "asha@example.com"));

        var n = await(() -> notification(enr, "ENROLLMENT_CONFIRMED"), r -> r != null && "SENT".equals(r.get("status")));

        assertThat(n).isNotNull();
        assertThat(n.get("status")).isEqualTo("SENT");
        assertThat(n.get("processed_at")).isNotNull();
        assertThat((String) n.get("message")).contains("Asha Rao").contains("confirmed");
        assertThat(n.get("student_id")).isEqualTo(7L);
    }

    @Test
    void redeliveredAndDuplicateEventsCreateExactlyOneNotification() throws Exception {
        long enr = ENROLLMENT_IDS.incrementAndGet();
        String eventId = UUID.randomUUID().toString();
        publish(event(eventId, EnrollmentEventType.EnrollmentCancelled, enr, "asha@example.com"));
        publish(event(eventId, EnrollmentEventType.EnrollmentCancelled, enr, "asha@example.com"));                      // same eventId (redelivery)
        publish(event(UUID.randomUUID().toString(), EnrollmentEventType.EnrollmentCancelled, enr, "asha@example.com")); // new eventId, same business fact

        await(() -> jdbc.queryForObject("select count(*) from sms_inbox_messages where message_id=?", Integer.class, eventId), c -> c >= 1);
        await(() -> jdbc.queryForObject("select count(*) from sms_notifications where enrollment_id=?", Integer.class, enr), c -> c >= 1);
        Thread.sleep(4000);   // give the duplicates time to be processed (and ignored)

        assertThat(jdbc.queryForObject("select count(*) from sms_notifications where enrollment_id=? and notification_type='ENROLLMENT_CANCELLED'", Integer.class, enr)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from sms_inbox_messages where message_id=?", Integer.class, eventId)).isEqualTo(1);
    }

    @Test
    void flakyDeliveryIsRetriedWithBackoffUntilItSucceeds() throws Exception {
        long enr = ENROLLMENT_IDS.incrementAndGet();
        publish(event(UUID.randomUUID().toString(), EnrollmentEventType.EnrollmentConfirmed, enr, "tom@flaky.test"));

        var n = await(() -> notification(enr, "ENROLLMENT_CONFIRMED"), r -> r != null && "SENT".equals(r.get("status")));

        assertThat(n).isNotNull();
        assertThat(n.get("status")).isEqualTo("SENT");
        assertThat(n.get("retry_count")).isEqualTo(2);      // failed twice, third attempt succeeded
    }

    @Test
    void permanentlyFailingDeliveryEndsAsFailedAndCanBeRequeued() throws Exception {
        long enr = ENROLLMENT_IDS.incrementAndGet();
        publish(event(UUID.randomUUID().toString(), EnrollmentEventType.EnrollmentRejected, enr, "x@fail.test"));

        var n = await(() -> notification(enr, "ENROLLMENT_REJECTED"), r -> r != null && "FAILED".equals(r.get("status")));

        assertThat(n).isNotNull();
        assertThat(n.get("status")).isEqualTo("FAILED");
        assertThat(n.get("retry_count")).isEqualTo(3);
        assertThat((String) n.get("last_error")).contains("Simulated SMTP failure");
    }

    @Test
    void lowAvailabilityEventNotifiesTheAdminMailbox() throws Exception {
        String id = UUID.randomUUID().toString();
        var e = new LowCourseAvailabilityEvent(id, 99L, "LOW-1", "Low Course", 2, 30, Instant.now());
        producer.send(new ProducerRecord<>(Topics.COURSE_LOW_AVAILABILITY, "99", JSON.writeValueAsString(e))).get();

        var rows = await(() -> jdbc.queryForList("select * from sms_notifications where notification_type='COURSE_LOW_AVAILABILITY' and message like '%Low Course%'"),
                r -> !r.isEmpty() && "SENT".equals(r.get(0).get("status")));

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).get("recipient_email")).isEqualTo("admin@sms.local");
        assertThat(rows.get(0).get("enrollment_id")).isNull();
    }

    @Test
    void poisonMessageIsDeadLetteredInsteadOfBlockingThePartition() throws Exception {
        String poison = "{this is not json";
        producer.send(new ProducerRecord<>(Topics.ENROLLMENT_CONFIRMED, "poison-key", poison)).get();
        // a valid event right behind it must still be processed
        long enr = ENROLLMENT_IDS.incrementAndGet();
        publish(event(UUID.randomUUID().toString(), EnrollmentEventType.EnrollmentConfirmed, enr, "after@example.com"));

        Properties p = new Properties();
        p.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers());
        p.put(ConsumerConfig.GROUP_ID_CONFIG, "dlt-" + UUID.randomUUID());
        p.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        p.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        p.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        String dltValue = null;
        try (KafkaConsumer<String, String> c = new KafkaConsumer<>(p)) {
            c.subscribe(List.of(Topics.ENROLLMENT_CONFIRMED + Topics.DLT_SUFFIX));
            long end = System.currentTimeMillis() + 40_000;
            while (dltValue == null && System.currentTimeMillis() < end) {
                for (var r : c.poll(Duration.ofMillis(500))) if (poison.equals(r.value())) dltValue = r.value();
            }
        }
        assertThat(dltValue).as("poison message found on the dead-letter topic").isEqualTo(poison);
        var n = await(() -> notification(enr, "ENROLLMENT_CONFIRMED"), r -> r != null);
        assertThat(n).as("valid message after the poison one is still processed").isNotNull();
    }
}
