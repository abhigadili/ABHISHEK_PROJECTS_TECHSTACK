package com.cricket.service;

import com.cricket.entity.Team;
import com.cricket.exception.ResourceNotFoundException;
import com.cricket.repository.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TeamService {

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

    @Transactional
    public Team create(Team team) {
        return teamRepository.save(team);
    }

    @Transactional
    public Team update(String id, Team team) {
        Team existing = findById(id);
        existing.setLeagueId(team.getLeagueId());
        existing.setName(team.getName());
        existing.setCaptain(team.getCaptain());
        existing.setCoach(team.getCoach());
        existing.setHomeGround(team.getHomeGround());
        existing.setTitles(team.getTitles());
        existing.setLogo(team.getLogo());
        existing.setDescription(team.getDescription());
        return teamRepository.save(existing);
    }

    @Transactional
    public void delete(String id) {
        findById(id);
        teamRepository.deleteById(id);
    }
}
