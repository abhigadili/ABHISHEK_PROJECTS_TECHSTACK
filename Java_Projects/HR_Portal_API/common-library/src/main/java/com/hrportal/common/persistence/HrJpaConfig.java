package com.hrportal.common.persistence;

import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import com.hrportal.common.security.CurrentUser;

/** Turns on JPA auditing: createdBy / updatedBy come from the authenticated caller ("system" for Kafka consumers/jobs). */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
@EnableTransactionManagement
public class HrJpaConfig {

    @Bean
    public AuditorAware<String> auditorAware() {
        return () -> Optional.of(CurrentUser.auditName());
    }
}
