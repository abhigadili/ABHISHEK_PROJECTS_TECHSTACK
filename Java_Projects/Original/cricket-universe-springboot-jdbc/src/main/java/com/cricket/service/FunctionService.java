package com.cricket.service;

import com.cricket.repository.FunctionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
public class FunctionService {

    private final FunctionRepository functionRepository;

    public FunctionService(FunctionRepository functionRepository) {
        this.functionRepository = functionRepository;
    }

    public BigDecimal battingAverage(int runs, int matches) {
        return functionRepository.battingAverage(runs, Math.max(matches, 1));
    }

    public String playerGrade(int runs, int wickets, String role) {
        return functionRepository.playerGrade(runs, wickets, role);
    }

    public String formatPlayerLabel(String name, String role, String team) {
        return functionRepository.formatPlayerLabel(name, role, team);
    }

    public List<Map<String, Object>> allPlayersWithComputedStats() {
        return functionRepository.findAllPlayersWithComputedStats();
    }
}
