package com.cricket.repository;

import com.cricket.model.Cricketer;

import java.sql.SQLException;
import java.util.List;

/**
 * Cricketer-specific repository contract.
 */
public interface CricketerRepository extends Repository<Cricketer, String> {

    /**
     * Filter cricketers by team and/or playing role.
     * @param teamId  null = all teams
     * @param role    null = all roles
     */
    List<Cricketer> findByTeamAndRole(String teamId, String role) throws SQLException;
}
