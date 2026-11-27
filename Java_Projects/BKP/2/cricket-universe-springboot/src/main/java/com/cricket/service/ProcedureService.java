package com.cricket.service;

import com.cricket.repository.ProcedureRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ProcedureService {

    private final ProcedureRepository procedureRepository;

    public ProcedureService(ProcedureRepository procedureRepository) {
        this.procedureRepository = procedureRepository;
    }

    public List<Map<String, Object>> listCountries(String search) {
        return procedureRepository.listCountries(search);
    }

    public List<Map<String, Object>> listLeagues(String countryId, String search) {
        return procedureRepository.listLeagues(countryId, search);
    }

    public List<Map<String, Object>> listTeams(String leagueId) {
        return procedureRepository.listTeams(leagueId);
    }

    public List<Map<String, Object>> listPlayers(String teamId, String role) {
        return procedureRepository.listPlayers(teamId, role);
    }

    public List<Map<String, Object>> allPlayersDetail(String countryId, String role) {
        return procedureRepository.allPlayersDetail(countryId, role);
    }

    public List<Map<String, Object>> cursorRoleRunTotals() {
        return procedureRepository.cursorRoleRunTotals();
    }

    public Map<String, List<Map<String, Object>>> windowFunctionsDemo() {
        return procedureRepository.windowFunctionsDemo();
    }

    public Map<String, List<Map<String, Object>>> analyticsDemo() {
        return procedureRepository.analyticsDemo();
    }
}
