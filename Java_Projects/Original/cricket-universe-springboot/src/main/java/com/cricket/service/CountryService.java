package com.cricket.service;

import com.cricket.entity.Country;
import com.cricket.exception.ResourceNotFoundException;
import com.cricket.repository.CountryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CountryService {

    private final CountryRepository countryRepository;

    public CountryService(CountryRepository countryRepository) {
        this.countryRepository = countryRepository;
    }

    public List<Country> findAll(String search) {
        if (search == null || search.isBlank()) {
            return countryRepository.findAll();
        }
        return countryRepository
                .findByNameContainingIgnoreCaseOrShortNameContainingIgnoreCaseOrBoardContainingIgnoreCase(
                        search, search, search);
    }

    public Country findById(String id) {
        return countryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Country not found: " + id));
    }

    @Transactional
    public Country create(Country country) {
        return countryRepository.save(country);
    }

    @Transactional
    public Country update(String id, Country country) {
        Country existing = findById(id);
        existing.setName(country.getName());
        existing.setShortName(country.getShortName());
        existing.setFlag(country.getFlag());
        existing.setDescription(country.getDescription());
        existing.setBackground(country.getBackground());
        existing.setEstablished(country.getEstablished());
        existing.setWorldCupsWon(country.getWorldCupsWon());
        existing.setBoard(country.getBoard());
        existing.setCoach(country.getCoach());
        existing.setCaptain(country.getCaptain());
        existing.setFamousPlayers(country.getFamousPlayers());
        return countryRepository.save(existing);
    }

    @Transactional
    public void delete(String id) {
        findById(id);
        countryRepository.deleteById(id);
    }
}
