package com.hrportal.common.persistence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Opt-in OPERATIONAL tools for a DEVELOPMENT database, both OFF by default:
 * <ul>
 *   <li>HR_FLYWAY_REPAIR=true  - Flyway "repair": removes FAILED migration entries from the schema history, then migrates.</li>
 *   <li>HR_FLYWAY_RESET=true   - Flyway "clean" + migrate: drops every object of THIS service's own database and rebuilds it from the
 *       migrations (also needs SPRING_FLYWAY_CLEAN_DISABLED=false). Never use outside a throw-away development schema.</li>
 * </ul>
 */
@Configuration
@ConditionalOnClass(name = "org.flywaydb.core.Flyway")
@ConditionalOnExpression("${hr.flyway.repair-on-start:false} or ${hr.flyway.reset-on-start:false}")
public class FlywayRepairConfig {
    private static final Logger log = LoggerFactory.getLogger(FlywayRepairConfig.class);

    @Bean
    public FlywayMigrationStrategy repairOrResetThenMigrate(@Value("${hr.flyway.reset-on-start:false}") boolean reset) {
        return flyway -> {
            if (reset) {
                log.warn("hr.flyway.reset-on-start=true: cleaning this service's database and rebuilding it from the migrations");
                flyway.clean();
            } else {
                log.warn("hr.flyway.repair-on-start=true: repairing the schema history before migrating");
                flyway.repair();
            }
            flyway.migrate();
        };
    }
}
