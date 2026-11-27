package com.cricket.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Singleton database connection manager.
 * Provides a single shared Connection to the cricket_universe MySQL database.
 */
public class DBConnection {

    private static final String URL      = "jdbc:mysql://localhost:3306/cricket_universe"
                                         + "?useSSL=false&serverTimezone=UTC"
                                         + "&characterEncoding=UTF-8"
                                         + "&connectionCollation=utf8mb4_unicode_ci"
                                         + "&allowPublicKeyRetrieval=true";
    private static final String USER     = "abhig";
    private static final String PASSWORD = "Pass@123";

    private static Connection connection;

    private DBConnection() {}

    public static Connection getConnection() throws SQLException {
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection(URL, USER, PASSWORD);
            System.out.println("  [DB] Connected to cricket_universe @ localhost:3306");
        }
        return connection;
    }

    public static void closeConnection() {
        if (connection != null) {
            try {
                connection.close();
                System.out.println("  [DB] Connection closed.");
            } catch (SQLException e) {
                System.err.println("  [DB] Error closing connection: " + e.getMessage());
            }
        }
    }
}
