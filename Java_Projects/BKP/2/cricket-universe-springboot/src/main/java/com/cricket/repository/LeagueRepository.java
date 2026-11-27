package com.cricket.repository;

import com.cricket.entity.League;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LeagueRepository extends JpaRepository<League, String> {

    List<League> findByCountryId(String countryId);

    List<League> findByNameContainingIgnoreCase(String search);

    List<League> findByCountryIdAndNameContainingIgnoreCase(String countryId, String search);
}
