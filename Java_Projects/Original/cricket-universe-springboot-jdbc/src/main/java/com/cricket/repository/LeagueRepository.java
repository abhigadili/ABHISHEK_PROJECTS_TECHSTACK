package com.cricket.repository;

import com.cricket.model.League;

import java.util.List;
import java.util.Optional;

public interface LeagueRepository {

    List<League> findAll();

    List<League> findByCountryId(String countryId);

    List<League> search(String term);

    List<League> findByCountryIdAndSearch(String countryId, String term);

    Optional<League> findById(String id);

    boolean existsById(String id);

    League insert(League league);

    int update(League league);

    int deleteById(String id);
}
