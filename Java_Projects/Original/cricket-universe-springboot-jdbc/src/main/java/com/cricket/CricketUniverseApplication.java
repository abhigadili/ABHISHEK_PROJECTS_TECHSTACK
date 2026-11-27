package com.cricket;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Application entry point.
 *
 * Architecture: Controller -> Service -> Repository -> JdbcTemplate -> MySQL (cricket_universe)
 *
 * This variant deliberately avoids Spring Data JPA / Hibernate. Every repository
 * is a plain interface backed by a JdbcTemplate implementation using RowMapper
 * and bound '?' parameters — the Repository Pattern here is entirely hand-written,
 * not framework-generated, so the SQL for every operation is visible and explicit.
 *
 * Run: mvn spring-boot:run   OR   java -jar target/cricket-universe-springboot-jdbc.jar
 */
@SpringBootApplication
public class CricketUniverseApplication {

    public static void main(String[] args) {
        SpringApplication.run(CricketUniverseApplication.class, args);
    }
}
