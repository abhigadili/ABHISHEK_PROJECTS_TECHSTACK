# 02 – Java and Spring Boot Configuration

## 1. Feature Overview
Java 21 (OpenJDK 21.0.7) with Spring Boot 3.4.5 and Spring Cloud 2024.0.1 (the compatible train for Boot 3.4.x per the Spring Cloud compatibility matrix).

## 2. Purpose
Use a current LTS and a mutually compatible set of releases; avoid version conflicts by importing BOMs instead of hard-coding transitive versions.

## 3. Files Created
No dedicated files – configuration lives in `pom.xml` ([01](01-Project-Setup-and-Maven-Configuration.md)) and the `application.yml` of every module ([28](28-Configuration-and-Environment-Variables.md)).

## 4. Files Modified
None.

## 5. Implementation Details
Resolved versions (taken from the local Maven repository after a successful build):

| Library | Version | Source |
|---|---|---|
| Spring Boot | 3.4.5 | parent |
| Spring Cloud (Gateway / OpenFeign / Eureka) | 2024.0.1 (4.2.1) | BOM |
| Hibernate ORM | 6.6.13.Final | Boot |
| Flyway (+ flyway-mysql) | 10.20.1 | Boot |
| MySQL Connector/J | 9.1.0 | Boot |
| Spring Kafka / kafka-clients | 3.3.5 / 3.8.1 | Boot |
| Spring Data Redis / Lettuce | 3.4.5 / 6.4.2 | Boot |
| Micrometer Tracing OTel bridge / OTLP exporter | 1.4.5 / 1.43.0 | Boot |
| Resilience4j | 2.2.0 | `resilience4j.version` property |
| springdoc-openapi | 2.8.6 | `springdoc.version` property |
| jjwt | 0.12.6 | `jjwt.version` property |
| JUnit Jupiter / Mockito | 5.11.4 / 5.14.2 | Boot |
| Testcontainers | 1.20.6 | Boot |
| Lombok | 1.18.38 | Boot |

Java 21 language features used: records (all DTOs, events, queries/commands), switch expressions (saga steps, notification mapping), pattern matching for `instanceof`, `Optional`/streams.

## 6. Architecture Details
`common-web` is a Spring Boot *auto-configuration* library: it supplies `JwtTokenService`, the correlation-id/request-log filter, the JWT authentication filter (not auto-registered as a servlet filter; services add it to the Security chain), the `@RestControllerAdvice`, an OpenAPI bean with the JWT bearer scheme, and a Kafka health indicator – each guarded by `@Conditional…` so it activates only where its classes exist (servlet vs. reactive, Kafka present or not).

## 7. Dependencies
See table above.

## 8. Configuration Changes
`java.version=21`, `spring-cloud.version=2024.0.1` in the parent POM.

## 9. Database Changes
None.

## 10. API Changes
None.

## 11. Communication Changes
None.

## 12. Execution Instructions
`java -version` must report 21; `mvn -v` ≥ 3.8.

## 13. Testing
Covered by the build itself (compiles on Java 21, all tests green – [26](26-Unit-and-Integration-Testing.md)).

## 14. Pending Items
None.
