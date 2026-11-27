package com.cricket.repository;

import com.cricket.model.Team;

import java.util.List;
import java.util.Optional;

public interface TeamRepository {

    List<Team> findAll();

    List<Team> findByLeagueId(String leagueId);

    Optional<Team> findById(String id);

    boolean existsById(String id);

    Team insert(Team team);

    int update(Team team);

    int deleteById(String id);
}
