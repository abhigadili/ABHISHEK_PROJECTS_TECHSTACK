package com.cricket.controller;

import com.cricket.model.Cricketer;
import com.cricket.service.CricketerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cricketers")
public class CricketerController {

    private final CricketerService cricketerService;

    public CricketerController(CricketerService cricketerService) {
        this.cricketerService = cricketerService;
    }

    @GetMapping
    public List<Cricketer> findAll(@RequestParam(required = false) String teamId,
                                    @RequestParam(required = false) String role) {
        return cricketerService.findAll(teamId, role);
    }

    @GetMapping("/{id}")
    public Cricketer findById(@PathVariable String id) {
        return cricketerService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Cricketer create(@Valid @RequestBody Cricketer cricketer) {
        return cricketerService.create(cricketer);
    }

    @PutMapping("/{id}")
    public Cricketer update(@PathVariable String id, @Valid @RequestBody Cricketer cricketer) {
        return cricketerService.update(id, cricketer);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        cricketerService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
