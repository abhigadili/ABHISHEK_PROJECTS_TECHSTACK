package com.cricket.service;

import com.cricket.model.League;
import com.cricket.repository.LeagueRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LeagueServiceTest {

    @Mock
    private LeagueRepository leagueRepository;

    @InjectMocks
    private LeagueService leagueService;

    @Test
    void findAll_noFilters_usesFindAll() {
        when(leagueRepository.findAll()).thenReturn(List.of());

        leagueService.findAll(null, null);

        verify(leagueRepository).findAll();
        verifyNoMoreInteractions(leagueRepository);
    }

    @Test
    void findAll_countryOnly_usesFindByCountryId() {
        when(leagueRepository.findByCountryId("ind")).thenReturn(List.of());

        leagueService.findAll("ind", "");

        verify(leagueRepository).findByCountryId("ind");
        verify(leagueRepository, never()).findAll();
    }

    @Test
    void findAll_searchOnly_usesSearch() {
        when(leagueRepository.search("ipl")).thenReturn(List.of());

        leagueService.findAll(null, "ipl");

        verify(leagueRepository).search("ipl");
    }

    @Test
    void findAll_countryAndSearch_usesCombinedFinder() {
        when(leagueRepository.findByCountryIdAndSearch("ind", "ipl")).thenReturn(List.of());

        List<League> result = leagueService.findAll("ind", "ipl");

        assertThat(result).isEmpty();
        verify(leagueRepository).findByCountryIdAndSearch("ind", "ipl");
    }
}
