package com.cricket.service;

import com.cricket.model.Cricketer;
import com.cricket.repository.CricketerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CricketerServiceTest {

    @Mock
    private CricketerRepository cricketerRepository;

    @InjectMocks
    private CricketerService cricketerService;

    @Test
    void findAll_teamAndRole_usesCombinedFinder() {
        when(cricketerRepository.findByTeamIdAndRole("csk", "Batsman")).thenReturn(List.of());

        cricketerService.findAll("csk", "Batsman");

        verify(cricketerRepository).findByTeamIdAndRole("csk", "Batsman");
    }

    @Test
    void findAll_teamOnly_usesFindByTeamId() {
        when(cricketerRepository.findByTeamId("csk")).thenReturn(List.of());

        cricketerService.findAll("csk", null);

        verify(cricketerRepository).findByTeamId("csk");
    }

    @Test
    void findAll_roleOnly_usesFindByRole() {
        when(cricketerRepository.findByRole("Bowler")).thenReturn(List.of());

        cricketerService.findAll(null, "Bowler");

        verify(cricketerRepository).findByRole("Bowler");
    }

    @Test
    void findAll_noFilters_usesFindAll() {
        when(cricketerRepository.findAll()).thenReturn(List.of());

        cricketerService.findAll(null, null);

        verify(cricketerRepository).findAll();
    }

    @Test
    void create_whenDuplicateId_throws() {
        Cricketer c = new Cricketer();
        c.setId("virat-kohli");
        when(cricketerRepository.existsById("virat-kohli")).thenReturn(true);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> cricketerService.create(c))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
