package com.cricket.controller;

import com.cricket.exception.ResourceNotFoundException;
import com.cricket.model.Country;
import com.cricket.service.CountryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * @WebMvcTest loads only the web layer (controllers, @ControllerAdvice,
 * WebMvcConfigurer beans like CorsConfig, Filter beans) — no real database,
 * confirming the HTTP contract, validation, CORS and error mapping all work
 * together without needing MySQL running.
 */
@WebMvcTest(CountryController.class)
class CountryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CountryService countryService;

    @Test
    void getAll_returnsJsonList() throws Exception {
        Country india = new Country();
        india.setId("ind");
        india.setName("India");
        india.setShortName("IND");
        when(countryService.findAll(null)).thenReturn(List.of(india));

        mockMvc.perform(get("/api/countries"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("ind"))
                .andExpect(jsonPath("$[0].name").value("India"));
    }

    @Test
    void getById_whenMissing_returns404WithJsonBody() throws Exception {
        when(countryService.findById("xyz")).thenThrow(new ResourceNotFoundException("Country not found: xyz"));

        mockMvc.perform(get("/api/countries/xyz"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Country not found: xyz"));
    }

    @Test
    void create_withMissingRequiredFields_returns400() throws Exception {
        mockMvc.perform(post("/api/countries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void corsPreflight_isAllowedOnApiPath() throws Exception {
        mockMvc.perform(options("/api/countries")
                        .header("Origin", "http://example.com")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://example.com"));
    }
}
