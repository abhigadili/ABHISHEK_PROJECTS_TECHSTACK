package com.cricket;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Application entry point.
 *
 * Architecture: Controller -> Service -> Repository -> MySQL (cricket_universe)
 *
 * Repository Pattern:
 *   - Spring Data JPA repositories (CountryRepository, LeagueRepository, TeamRepository,
 *     CricketerRepository, LoginUserRepository, Audit*Repository) handle CRUD on plain tables.
 *   - Custom repositories (ViewRepository, ProcedureRepository, FunctionRepository) wrap
 *     JdbcTemplate to expose SQL views, stored procedures and user-defined functions behind
 *     the same repository abstraction, so Services never talk to JDBC/SQL directly.
 *
 * Run: mvn spring-boot:run   OR   java -jar target/cricket-universe-springboot.jar
 */
@SpringBootApplication
public class CricketUniverseApplication {

    public static void main(String[] args) {
        SpringApplication.run(CricketUniverseApplication.class, args);
    }
}
