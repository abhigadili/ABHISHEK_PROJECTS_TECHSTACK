package com.cricket.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Central JDBC connection factory.
 *
 * Design: Each DAO call opens and closes its own connection.
 * This is thread-safe for a servlet environment — every request
 * gets an independent connection from DriverManager.
 *
 * Production note: Replace DriverManager with HikariCP or
 * Tomcat JDBC Pool to avoid the overhead of opening a new
 * OS-level socket on every request.
 *
 * SQL-Injection note: This class only supplies a Connection.
 * All parameterisation is done in the DAO layer using
 * PreparedStatement — user input NEVER touches the SQL string.
 */
public class DBConnection {

    private static final String HOST     = "localhost";
    private static final String PORT     = "3306";
    private static final String DATABASE = "cricket_universe";
    private static final String USER     = "abhig";
    private static final String PASSWORD = "Pass@123";

    /**
     * Connection URL — key parameters:
     *   useSSL=false                  skip SSL for local dev
     *   serverTimezone=UTC            prevents timezone parse errors
     *   characterEncoding=UTF-8       handles emoji / unicode
     *   connectionCollation=...       matches table collation (avoids error 1267)
     *   allowPublicKeyRetrieval=true  required when useSSL=false
     *   rewriteBatchedStatements=true future batch inserts run faster
     */
    private static final String URL =
            "jdbc:mysql://" + HOST + ":" + PORT + "/" + DATABASE
            + "?useSSL=false"
            + "&serverTimezone=UTC"
            + "&characterEncoding=UTF-8"
            + "&connectionCollation=utf8mb4_unicode_ci"
            + "&allowPublicKeyRetrieval=true"
            + "&rewriteBatchedStatements=true";

    private DBConnection() {}

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }
}
