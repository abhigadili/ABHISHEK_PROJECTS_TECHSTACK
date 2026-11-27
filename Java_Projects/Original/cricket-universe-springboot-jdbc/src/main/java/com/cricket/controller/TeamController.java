package com.cricket.controller;

import com.cricket.model.Team;
import com.cricket.service.TeamService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @GetMapping
    public List<Team> findAll(@RequestParam(required = false) String leagueId) {
        return teamService.findAll(leagueId);
    }

    @GetMapping("/{id}")
    public Team findById(@PathVariable String id) {
        return teamService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Team create(@Valid @RequestBody Team team) {
        return teamService.create(team);
    }

    @PutMapping("/{id}")
    public Team update(@PathVariable String id, @Valid @RequestBody Team team) {
        return teamService.update(id, team);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        teamService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
