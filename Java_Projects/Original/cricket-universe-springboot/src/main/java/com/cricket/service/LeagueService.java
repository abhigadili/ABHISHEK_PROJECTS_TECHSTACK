package com.cricket.service;

import com.cricket.entity.League;
import com.cricket.exception.ResourceNotFoundException;
import com.cricket.repository.LeagueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class LeagueService {

    private final LeagueRepository leagueRepository;

    public LeagueService(LeagueRepository leagueRepository) {
        this.leagueRepository = leagueRepository;
    }

    public List<League> findAll(String countryId, String search) {
        boolean hasCountry = countryId != null && !countryId.isBlank();
        boolean hasSearch = search != null && !search.isBlank();

        if (hasCountry && hasSearch) {
            return leagueRepository.findByCountryIdAndNameContainingIgnoreCase(countryId, search);
        }
        if (hasCountry) {
            return leagueRepository.findByCountryId(countryId);
        }
        if (hasSearch) {
            return leagueRepository.findByNameContainingIgnoreCase(search);
        }
        return leagueRepository.findAll();
    }

    public League findById(String id) {
        return leagueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("League not found: " + id));
    }

    @Transactional
    public League create(League league) {
        return leagueRepository.save(league);
    }

    @Transactional
    public League update(String id, League league) {
        League existing = findById(id);
        existing.setCountryId(league.getCountryId());
        existing.setName(league.getName());
        existing.setDescription(league.getDescription());
        existing.setEstablished(league.getEstablished());
        existing.setFormat(league.getFormat());
        existing.setTrophy(league.getTrophy());
        existing.setImage(league.getImage());
        return leagueRepository.save(existing);
    }

    @Transactional
    public void delete(String id) {
        findById(id);
        leagueRepository.deleteById(id);
    }
}
