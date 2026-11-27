package com.cricket.repository;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * Generic Repository interface — the contract every data-access class must fulfil.
 *
 * <T>  — the domain model type (Country, League, Team, Cricketer)
 * <ID> — the primary-key type (String for all our tables)
 *
 * The Repository Pattern separates "what data operations are available" (this interface)
 * from "how those operations are implemented" (the JDBC classes in repository/impl/).
 *
 * Benefits:
 *  - Servlets and Services depend only on this interface, never on JDBC details.
 *  - Swapping MySQL for PostgreSQL or an in-memory store only requires a new impl class.
 *  - Unit tests can use a mock implementation without a real database.
 */
public interface Repository<T, ID> {

    /** Return every row, optionally filtered (null filter = no filter). */
    List<T> findAll() throws SQLException;

    /** Return a single row by primary key, or empty if not found. */
    Optional<T> findById(ID id) throws SQLException;

    /** Persist a new row. Returns the saved entity. */
    T save(T entity) throws SQLException;

    /** Update an existing row. Returns the updated entity, or empty if id not found. */
    Optional<T> update(ID id, T entity) throws SQLException;

    /** Delete by primary key. Returns true if a row was actually deleted. */
    boolean delete(ID id) throws SQLException;
}
