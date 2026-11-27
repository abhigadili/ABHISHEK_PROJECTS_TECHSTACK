package com.cricket.controller;

import com.cricket.model.League;
import com.cricket.service.LeagueService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/leagues")
public class LeagueController {

    private final LeagueService leagueService;

    public LeagueController(LeagueService leagueService) {
        this.leagueService = leagueService;
    }

    @GetMapping
    public List<League> findAll(@RequestParam(required = false) String countryId,
                                 @RequestParam(required = false) String search) {
        return leagueService.findAll(countryId, search);
    }

    @GetMapping("/{id}")
    public League findById(@PathVariable String id) {
        return leagueService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public League create(@Valid @RequestBody League league) {
        return leagueService.create(league);
    }

    @PutMapping("/{id}")
    public League update(@PathVariable String id, @Valid @RequestBody League league) {
        return leagueService.update(id, league);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        leagueService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
