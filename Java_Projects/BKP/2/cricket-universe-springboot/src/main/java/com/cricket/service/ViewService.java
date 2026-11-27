package com.cricket.service;

import com.cricket.repository.ViewRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ViewService {

    private final ViewRepository viewRepository;

    public ViewService(ViewRepository viewRepository) {
        this.viewRepository = viewRepository;
    }

    public List<Map<String, Object>> countriesLeagues() {
        return viewRepository.findCountriesLeagues();
    }

    public List<Map<String, Object>> teamsPlayers() {
        return viewRepository.findTeamsPlayers();
    }

    public List<Map<String, Object>> allPlayersDetail() {
        return viewRepository.findAllPlayersDetail();
    }
}
