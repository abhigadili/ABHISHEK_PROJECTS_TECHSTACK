#!/usr/bin/env bash
# Scaffolds a servlet-based microservice module: pom.xml, Application class, application{,-dev,-prod}.yml.
# usage: gen-service.sh <name e.g. order> <port> <db e.g. food_order_db> <ClassPrefix e.g. Order>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
N="$1"; PORT="$2"; DB="$3"; CLS="$4"
M="$ROOT/$N-service"
PKG="com/fooddelivery/$N"
mkdir -p "$M/src/main/java/$PKG" "$M/src/main/resources/db/migration"
cat > "$M/pom.xml" <<POM
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent><groupId>com.fooddelivery</groupId><artifactId>food-parent</artifactId><version>1.0.0</version></parent>
  <artifactId>$N-service</artifactId>
  <name>$N-service</name>
  <dependencies>
    <dependency><groupId>com.fooddelivery</groupId><artifactId>food-common</artifactId></dependency>
    <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><scope>provided</scope></dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId><artifactId>maven-compiler-plugin</artifactId>
        <configuration><annotationProcessorPaths>
          <path><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><version>\${lombok.version}</version></path>
        </annotationProcessorPaths></configuration>
      </plugin>
      <plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin>
    </plugins>
  </build>
</project>
POM
[ -f "$M/src/main/java/$PKG/${CLS}ServiceApplication.java" ] || cat > "$M/src/main/java/$PKG/${CLS}ServiceApplication.java" <<JAVA
package com.fooddelivery.$N;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Entry point of the $N-service (own Spring Boot application, own port, own database \`$DB\`). */
@SpringBootApplication(scanBasePackages = {"com.fooddelivery.$N", "com.fooddelivery.common"})
@EntityScan({"com.fooddelivery.$N", "com.fooddelivery.common.kafka.outbox"})
@EnableJpaRepositories({"com.fooddelivery.$N", "com.fooddelivery.common.kafka.outbox"})
@EnableFeignClients(basePackages = "com.fooddelivery.$N")
public class ${CLS}ServiceApplication {
    public static void main(String[] args) { SpringApplication.run(${CLS}ServiceApplication.class, args); }
}
JAVA
[ -f "$M/src/main/resources/application.yml" ] || cat > "$M/src/main/resources/application.yml" <<YML
spring:
  application:
    name: $N-service
  config:
    import: classpath:food-common.yml
  datasource:
    url: jdbc:mysql://\${MYSQL_HOST:localhost}:\${MYSQL_PORT:3306}/$DB?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=utf8
server:
  port: $PORT
YML
cat > "$M/src/main/resources/application-dev.yml" <<YML
# Development profile: verbose application logging, Swagger UI on.
logging:
  level:
    com.fooddelivery: debug
springdoc:
  swagger-ui:
    enabled: true
YML
cat > "$M/src/main/resources/application-prod.yml" <<YML
# Production profile: quiet logs, Swagger UI off, actuator details limited, no schema auto-changes.
logging:
  level:
    com.fooddelivery: info
springdoc:
  swagger-ui:
    enabled: false
  api-docs:
    enabled: false
spring:
  jpa:
    hibernate:
      ddl-auto: validate
YML
echo "scaffolded $N-service on :$PORT ($DB)"
