package com.hospital.notification.config;

import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;
import org.hibernate.boot.model.naming.Identifier;
import org.hibernate.engine.jdbc.env.spi.JdbcEnvironment;

/**
 * NotificationDB already exists on the shared MySQL server and holds tables of other applications
 * (Notifications, sms_*, dn_*, flyway/EF history...). Every table of this project in that database is
 * therefore prefixed with "hms_" so nothing existing is touched or clashes.
 */
public class HmsTablePrefixNamingStrategy extends CamelCaseToUnderscoresNamingStrategy {
    private static final String PREFIX = "hms_";

    @Override
    public Identifier toPhysicalTableName(Identifier logicalName, JdbcEnvironment env) {
        Identifier id = super.toPhysicalTableName(logicalName, env);
        return id == null ? null : Identifier.toIdentifier(PREFIX + id.getText(), id.isQuoted());
    }
}
