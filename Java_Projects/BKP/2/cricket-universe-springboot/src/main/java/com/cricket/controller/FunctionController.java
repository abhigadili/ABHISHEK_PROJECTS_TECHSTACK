package com.cricket.controller;

import com.cricket.service.FunctionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/functions")
public class FunctionController {

    private final FunctionService functionService;

    public FunctionController(FunctionService functionService) {
        this.functionService = functionService;
    }

    @GetMapping("/batting-average")
    public Map<String, Object> battingAverage(@RequestParam(defaultValue = "0") int runs,
                                               @RequestParam(defaultValue = "1") int matches) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("battingAverage", functionService.battingAverage(runs, matches));
        result.put("inputs", Map.of("runs", runs, "matches", matches));
        return result;
    }

    @GetMapping("/player-grade")
    public Map<String, Object> playerGrade(@RequestParam(defaultValue = "0") int runs,
                                            @RequestParam(defaultValue = "0") int wickets,
                                            @RequestParam(defaultValue = "Batsman") String role) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("playerGrade", functionService.playerGrade(runs, wickets, role));
        result.put("inputs", Map.of("runs", runs, "wickets", wickets, "role", role));
        return result;
    }

    @GetMapping("/player-label")
    public Map<String, Object> playerLabel(@RequestParam(defaultValue = "Unknown") String name,
                                            @RequestParam(defaultValue = "Batsman") String role,
                                            @RequestParam(defaultValue = "Unknown Team") String team) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("playerLabel", functionService.formatPlayerLabel(name, role, team));
        result.put("inputs", Map.of("name", name, "role", role, "team", team));
        return result;
    }

    @GetMapping("/all-players")
    public List<Map<String, Object>> allPlayers() {
        return functionService.allPlayersWithComputedStats();
    }
}
