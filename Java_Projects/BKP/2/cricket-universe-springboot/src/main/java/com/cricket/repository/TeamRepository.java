package com.cricket.repository;

import com.cricket.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeamRepository extends JpaRepository<Team, String> {

    List<Team> findByLeagueId(String leagueId);
}
