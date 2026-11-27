package com.cricket.controller;

import com.cricket.model.Country;
import com.cricket.service.CountryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/countries")
public class CountryController {

    private final CountryService countryService;

    public CountryController(CountryService countryService) {
        this.countryService = countryService;
    }

    @GetMapping
    public List<Country> findAll(@RequestParam(required = false) String search) {
        return countryService.findAll(search);
    }

    @GetMapping("/{id}")
    public Country findById(@PathVariable String id) {
        return countryService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Country create(@Valid @RequestBody Country country) {
        return countryService.create(country);
    }

    @PutMapping("/{id}")
    public Country update(@PathVariable String id, @Valid @RequestBody Country country) {
        return countryService.update(id, country);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        countryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
