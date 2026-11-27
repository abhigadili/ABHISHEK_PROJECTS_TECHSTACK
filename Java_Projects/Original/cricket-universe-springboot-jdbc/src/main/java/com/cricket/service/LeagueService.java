package com.cricket.service;

import com.cricket.exception.ResourceNotFoundException;
import com.cricket.model.League;
import com.cricket.repository.LeagueRepository;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LeagueService {

    private static final Logger log = LogManager.getLogger(LeagueService.class);

    private final LeagueRepository leagueRepository;

    public LeagueService(LeagueRepository leagueRepository) {
        this.leagueRepository = leagueRepository;
    }

    public List<League> findAll(String countryId, String search) {
        boolean hasCountry = countryId != null && !countryId.isBlank();
        boolean hasSearch = search != null && !search.isBlank();

        if (hasCountry && hasSearch) {
            return leagueRepository.findByCountryIdAndSearch(countryId, search);
        }
        if (hasCountry) {
            return leagueRepository.findByCountryId(countryId);
        }
        if (hasSearch) {
            return leagueRepository.search(search);
        }
        return leagueRepository.findAll();
    }

    public League findById(String id) {
        return leagueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("League not found: " + id));
    }

    public League create(League league) {
        if (leagueRepository.existsById(league.getId())) {
            throw new IllegalArgumentException("League already exists: " + league.getId());
        }
        League saved = leagueRepository.insert(league);
        log.info("Created league {}", saved.getId());
        return saved;
    }

    public League update(String id, League league) {
        findById(id);
        league.setId(id);
        leagueRepository.update(league);
        log.info("Updated league {}", id);
        return leagueRepository.findById(id).orElseThrow();
    }

    public void delete(String id) {
        findById(id);
        leagueRepository.deleteById(id);
        log.info("Deleted league {}", id);
    }
}
