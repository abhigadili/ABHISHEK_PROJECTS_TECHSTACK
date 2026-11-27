package com.cricket.controller;

import com.cricket.service.ViewService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/views")
public class ViewController {

    private final ViewService viewService;

    public ViewController(ViewService viewService) {
        this.viewService = viewService;
    }

    @GetMapping("/countries-leagues")
    public List<Map<String, Object>> countriesLeagues() {
        return viewService.countriesLeagues();
    }

    @GetMapping("/teams-players")
    public List<Map<String, Object>> teamsPlayers() {
        return viewService.teamsPlayers();
    }

    @GetMapping("/all-players")
    public List<Map<String, Object>> allPlayersDetail() {
        return viewService.allPlayersDetail();
    }
}
