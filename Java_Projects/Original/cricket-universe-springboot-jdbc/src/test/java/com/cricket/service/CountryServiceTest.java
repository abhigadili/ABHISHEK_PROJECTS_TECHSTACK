package com.cricket.service;

import com.cricket.exception.ResourceNotFoundException;
import com.cricket.model.Country;
import com.cricket.repository.CountryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CountryServiceTest {

    @Mock
    private CountryRepository countryRepository;

    @InjectMocks
    private CountryService countryService;

    private Country india;

    @BeforeEach
    void setUp() {
        india = new Country();
        india.setId("ind");
        india.setName("India");
        india.setShortName("IND");
    }

    @Test
    void findAll_withoutSearch_delegatesToFindAll() {
        when(countryRepository.findAll()).thenReturn(List.of(india));

        List<Country> result = countryService.findAll(null);

        assertThat(result).containsExactly(india);
        verify(countryRepository).findAll();
        verify(countryRepository, never()).search(any());
    }

    @Test
    void findAll_withSearch_delegatesToSearch() {
        when(countryRepository.search("ind")).thenReturn(List.of(india));

        List<Country> result = countryService.findAll("ind");

        assertThat(result).containsExactly(india);
        verify(countryRepository).search("ind");
    }

    @Test
    void findById_whenPresent_returnsCountry() {
        when(countryRepository.findById("ind")).thenReturn(Optional.of(india));

        Country result = countryService.findById("ind");

        assertThat(result).isEqualTo(india);
    }

    @Test
    void findById_whenMissing_throwsResourceNotFound() {
        when(countryRepository.findById("xyz")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> countryService.findById("xyz"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("xyz");
    }

    @Test
    void create_whenIdAlreadyExists_throwsIllegalArgument() {
        when(countryRepository.existsById("ind")).thenReturn(true);

        assertThatThrownBy(() -> countryService.create(india))
                .isInstanceOf(IllegalArgumentException.class);

        verify(countryRepository, never()).insert(any());
    }

    @Test
    void create_whenNew_insertsAndReturnsSaved() {
        when(countryRepository.existsById("ind")).thenReturn(false);
        when(countryRepository.insert(india)).thenReturn(india);

        Country result = countryService.create(india);

        assertThat(result).isEqualTo(india);
        verify(countryRepository).insert(india);
    }

    @Test
    void delete_whenMissing_throwsBeforeDeleting() {
        when(countryRepository.findById("xyz")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> countryService.delete("xyz"))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(countryRepository, never()).deleteById(any());
    }
}
