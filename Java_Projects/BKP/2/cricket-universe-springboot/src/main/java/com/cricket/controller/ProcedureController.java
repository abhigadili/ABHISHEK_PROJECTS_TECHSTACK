package com.cricket.controller;

import com.cricket.service.ProcedureService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/procedures")
public class ProcedureController {

    private final ProcedureService procedureService;

    public ProcedureController(ProcedureService procedureService) {
        this.procedureService = procedureService;
    }

    @GetMapping("/list-countries")
    public List<Map<String, Object>> listCountries(@RequestParam(required = false) String search) {
        return procedureService.listCountries(search);
    }

    @GetMapping("/list-leagues")
    public List<Map<String, Object>> listLeagues(@RequestParam(required = false) String countryId,
                                                  @RequestParam(required = false) String search) {
        return procedureService.listLeagues(countryId, search);
    }

    @GetMapping("/list-teams")
    public List<Map<String, Object>> listTeams(@RequestParam(required = false) String leagueId) {
        return procedureService.listTeams(leagueId);
    }

    @GetMapping("/list-players")
    public List<Map<String, Object>> listPlayers(@RequestParam(required = false) String teamId,
                                                  @RequestParam(required = false) String role) {
        return procedureService.listPlayers(teamId, role);
    }

    @GetMapping("/all-players-detail")
    public List<Map<String, Object>> allPlayersDetail(@RequestParam(required = false) String countryId,
                                                        @RequestParam(required = false) String role) {
        return procedureService.allPlayersDetail(countryId, role);
    }

    @GetMapping("/cursor-role-totals")
    public List<Map<String, Object>> cursorRoleTotals() {
        return procedureService.cursorRoleRunTotals();
    }

    @GetMapping("/window-functions")
    public Map<String, List<Map<String, Object>>> windowFunctions() {
        return procedureService.windowFunctionsDemo();
    }

    @GetMapping("/analytics")
    public Map<String, List<Map<String, Object>>> analytics() {
        return procedureService.analyticsDemo();
    }
}
