package com.cricket.service;

import com.cricket.exception.ResourceNotFoundException;
import com.cricket.model.Country;
import com.cricket.repository.CountryRepository;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CountryService {

    private static final Logger log = LogManager.getLogger(CountryService.class);

    private final CountryRepository countryRepository;

    public CountryService(CountryRepository countryRepository) {
        this.countryRepository = countryRepository;
    }

    public List<Country> findAll(String search) {
        if (search == null || search.isBlank()) {
            return countryRepository.findAll();
        }
        log.debug("Searching countries with term '{}'", search);
        return countryRepository.search(search);
    }

    public Country findById(String id) {
        return countryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Country not found: " + id));
    }

    public Country create(Country country) {
        if (countryRepository.existsById(country.getId())) {
            throw new IllegalArgumentException("Country already exists: " + country.getId());
        }
        Country saved = countryRepository.insert(country);
        log.info("Created country {}", saved.getId());
        return saved;
    }

    public Country update(String id, Country country) {
        findById(id);
        country.setId(id);
        countryRepository.update(country);
        log.info("Updated country {}", id);
        return countryRepository.findById(id).orElseThrow();
    }

    public void delete(String id) {
        findById(id);
        countryRepository.deleteById(id);
        log.info("Deleted country {}", id);
    }
}
