package com.cricket.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Opens a fresh JDBC connection on every call.
 *
 * Thread-safety: each servlet request gets its own Connection, so there are no
 * shared-state issues. In production, replace DriverManager with a HikariCP pool.
 *
 * connectionCollation=utf8mb4_unicode_ci  — tables use utf8mb4_unicode_ci;
 * without this the server's default (utf8mb4_0900_ai_ci) would cause
 * SQL Error [1267] collation mismatch in stored-procedure calls.
 */
public class DBConnection {

    private static final String URL =
            "jdbc:mysql://localhost:3306/cricket_universe" +
            "?useSSL=false" +
            "&allowPublicKeyRetrieval=true" +
            "&connectionCollation=utf8mb4_unicode_ci" +
            "&serverTimezone=UTC";

    private static final String USER     = "abhig";
    private static final String PASSWORD = "Pass@123";

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }

    private DBConnection() {}
}
