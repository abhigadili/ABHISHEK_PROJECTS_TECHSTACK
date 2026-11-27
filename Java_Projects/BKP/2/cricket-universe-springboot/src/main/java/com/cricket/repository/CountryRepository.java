package com.cricket.repository;

import com.cricket.entity.Country;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data JPA generates the implementation at runtime and always binds
 * derived-query parameters as PreparedStatement placeholders — string
 * concatenation into SQL never happens here, which is what rules out SQL
 * injection for every method below.
 */
public interface CountryRepository extends JpaRepository<Country, String> {

    List<Country> findByNameContainingIgnoreCaseOrShortNameContainingIgnoreCaseOrBoardContainingIgnoreCase(
            String name, String shortName, String board);
}
