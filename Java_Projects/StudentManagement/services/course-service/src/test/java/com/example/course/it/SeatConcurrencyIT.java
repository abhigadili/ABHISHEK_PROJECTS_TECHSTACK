package com.example.course.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.common.exception.ConflictException;
import com.example.course.dto.CourseRequest;
import com.example.course.dto.CourseResponse;
import com.example.course.dto.SeatDtos.SeatResponse;
import com.example.course.service.CourseService;
import com.example.course.service.SeatService;
import com.example.events.LowCourseAvailabilityEvent;
import com.example.events.Topics;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;

class SeatConcurrencyIT extends AbstractIT {
    @Autowired CourseService courses;
    @Autowired SeatService seats;
    @Autowired JdbcTemplate jdbc;
    @Autowired CacheManager cacheManager;

    private CourseResponse newCourse(int seats) {
        return courses.create(new CourseRequest("Course", "C-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(), null, null, 4, new BigDecimal("100.00"), seats, null));
    }

    private int available(long courseId) { return jdbc.queryForObject("select available_seats from sms_courses where course_id=?", Integer.class, courseId); }

    private record Outcome(int ok, int conflicts, List<Throwable> unexpected) {}

    private Outcome race(int threads, java.util.function.IntFunction<Callable<SeatResponse>> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<SeatResponse>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            Callable<SeatResponse> c = task.apply(i);
            futures.add(pool.submit(() -> { start.await(); return c.call(); }));
        }
        start.countDown();
        int ok = 0, conflicts = 0;
        List<Throwable> unexpected = new ArrayList<>();
        for (Future<SeatResponse> f : futures) {
            try { f.get(60, TimeUnit.SECONDS); ok++; }
            catch (ExecutionException e) {
                if (e.getCause() instanceof ConflictException) conflicts++; else unexpected.add(e.getCause());
            }
        }
        pool.shutdownNow();
        return new Outcome(ok, conflicts, unexpected);
    }

    @Test
    void fiftyConcurrentReservationsOnTenSeatsNeverOversell() throws Exception {
        CourseResponse c = newCourse(10);
        Outcome o = race(50, i -> () -> seats.reserve(c.courseId(), 1000L + i));

        assertThat(o.unexpected()).isEmpty();
        assertThat(o.ok()).isEqualTo(10);
        assertThat(o.conflicts()).isEqualTo(40);
        assertThat(available(c.courseId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from sms_seat_reservations where course_id=? and status='RESERVED'", Integer.class, c.courseId())).isEqualTo(10);
    }

    @Test
    void concurrentReleasesAreIdempotentAndNeverExceedCapacity() throws Exception {
        CourseResponse c = newCourse(5);
        for (int i = 0; i < 5; i++) seats.reserve(c.courseId(), 2000L + i);
        assertThat(available(c.courseId())).isZero();

        // every enrollment is released by 4 competing threads
        Outcome o = race(20, i -> () -> seats.release(c.courseId(), 2000L + (i % 5)));

        assertThat(o.unexpected()).isEmpty();
        assertThat(available(c.courseId())).isEqualTo(5);                // exactly +5, not +20
        assertThat(jdbc.queryForObject("select count(*) from sms_seat_reservations where course_id=? and status='RELEASED'", Integer.class, c.courseId())).isEqualTo(5);
    }

    @Test
    void manyThreadsReservingForTheSameEnrollmentConsumeExactlyOneSeat() throws Exception {
        CourseResponse c = newCourse(10);
        Outcome o = race(10, i -> () -> seats.reserve(c.courseId(), 3000L));

        assertThat(available(c.courseId())).isEqualTo(9);
        assertThat(jdbc.queryForObject("select count(*) from sms_seat_reservations where enrollment_id=3000", Integer.class)).isEqualTo(1);
        assertThat(o.ok()).isGreaterThanOrEqualTo(1);   // losers either replay idempotently or roll back on the unique key (their decrement is rolled back too)
    }

    @Test
    void checkConstraintBlocksNegativeSeatsEvenOnDirectSql() {
        CourseResponse c = newCourse(1);
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> jdbc.update("update sms_courses set available_seats = -1 where course_id=?", c.courseId()));
    }

    @Test
    void availabilityIsCachedAndEvictedAfterSeatChange() {
        CourseResponse c = newCourse(10);
        assertThat(courses.availability(c.courseId()).availableSeats()).isEqualTo(10);
        assertThat(cacheManager.getCache("courseAvailability").get(c.courseId())).isNotNull();

        seats.reserve(c.courseId(), 4000L);

        assertThat(cacheManager.getCache("courseAvailability").get(c.courseId())).as("evicted after commit").isNull();
        assertThat(courses.availability(c.courseId()).availableSeats()).isEqualTo(9);
    }

    @Test
    void changingCapacityKeepsReservedSeatsAndRefusesToGoBelowThem() {
        CourseResponse c = newCourse(10);
        seats.reserve(c.courseId(), 5000L);
        seats.reserve(c.courseId(), 5001L);

        CourseResponse bigger = courses.update(c.courseId(), new CourseRequest("Course", c.courseCode(), null, null, 4, new BigDecimal("100.00"), 20, null));
        assertThat(bigger.totalSeats()).isEqualTo(20);
        assertThat(bigger.availableSeats()).isEqualTo(18);

        org.junit.jupiter.api.Assertions.assertThrows(com.example.common.exception.BusinessRuleException.class,
                () -> courses.update(c.courseId(), new CourseRequest("Course", c.courseCode(), null, null, 4, new BigDecimal("100.00"), 1, null)));
        assertThat(available(c.courseId())).isEqualTo(18);
    }

    @Test
    void lowAvailabilityEventIsPublishedToKafkaAfterCommit() throws Exception {
        CourseResponse c = newCourse(5);           // threshold is 3 in this test context
        for (int i = 0; i < 3; i++) seats.reserve(c.courseId(), 6000L + i);   // 4, 3, 2 seats left -> events for 3 and 2

        Properties p = new Properties();
        p.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers());
        p.put(ConsumerConfig.GROUP_ID_CONFIG, "it-" + UUID.randomUUID());
        p.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        p.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        p.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        ObjectMapper om = new ObjectMapper().registerModule(new JavaTimeModule());
        List<LowCourseAvailabilityEvent> mine = new ArrayList<>();
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(p)) {
            consumer.subscribe(List.of(Topics.COURSE_LOW_AVAILABILITY));
            long end = System.currentTimeMillis() + 30_000;
            while (mine.size() < 2 && System.currentTimeMillis() < end) {
                consumer.poll(Duration.ofMillis(500)).forEach(r -> {
                    try {
                        LowCourseAvailabilityEvent e = om.readValue(r.value(), LowCourseAvailabilityEvent.class);
                        if (e.courseId().equals(c.courseId())) mine.add(e);
                    } catch (Exception ex) { throw new RuntimeException(ex); }
                });
            }
        }
        assertThat(mine).extracting(LowCourseAvailabilityEvent::availableSeats).containsExactlyInAnyOrder(3, 2);
        assertThat(mine.get(0).totalSeats()).isEqualTo(5);
        assertThat(mine.get(0).eventId()).isNotBlank();
    }
}
