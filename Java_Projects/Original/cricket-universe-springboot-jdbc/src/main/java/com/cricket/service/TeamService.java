package com.cricket.service;

import com.cricket.exception.ResourceNotFoundException;
import com.cricket.model.Team;
import com.cricket.repository.TeamRepository;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TeamService {

    private static final Logger log = LogManager.getLogger(TeamService.class);

    private final TeamRepository teamRepository;

    public TeamService(TeamRepository teamRepository) {
        this.teamRepository = teamRepository;
    }

    public List<Team> findAll(String leagueId) {
        if (leagueId == null || leagueId.isBlank()) {
            return teamRepository.findAll();
        }
        return teamRepository.findByLeagueId(leagueId);
    }

    public Team findById(String id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found: " + id));
    }

    public Team create(Team team) {
        if (teamRepository.existsById(team.getId())) {
            throw new IllegalArgumentException("Team already exists: " + team.getId());
        }
        Team saved = teamRepository.insert(team);
        log.info("Created team {}", saved.getId());
        return saved;
    }

    public Team update(String id, Team team) {
        findById(id);
        team.setId(id);
        teamRepository.update(team);
        log.info("Updated team {}", id);
        return teamRepository.findById(id).orElseThrow();
    }

    public void delete(String id) {
        findById(id);
        teamRepository.deleteById(id);
        log.info("Deleted team {}", id);
    }
}
