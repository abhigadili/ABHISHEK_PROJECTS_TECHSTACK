package com.cricket.service;

import com.cricket.exception.ResourceNotFoundException;
import com.cricket.model.Cricketer;
import com.cricket.repository.CricketerRepository;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CricketerService {

    private static final Logger log = LogManager.getLogger(CricketerService.class);

    private final CricketerRepository cricketerRepository;

    public CricketerService(CricketerRepository cricketerRepository) {
        this.cricketerRepository = cricketerRepository;
    }

    public List<Cricketer> findAll(String teamId, String role) {
        boolean hasTeam = teamId != null && !teamId.isBlank();
        boolean hasRole = role != null && !role.isBlank();

        if (hasTeam && hasRole) {
            return cricketerRepository.findByTeamIdAndRole(teamId, role);
        }
        if (hasTeam) {
            return cricketerRepository.findByTeamId(teamId);
        }
        if (hasRole) {
            return cricketerRepository.findByRole(role);
        }
        return cricketerRepository.findAll();
    }

    public Cricketer findById(String id) {
        return cricketerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cricketer not found: " + id));
    }

    public Cricketer create(Cricketer cricketer) {
        if (cricketerRepository.existsById(cricketer.getId())) {
            throw new IllegalArgumentException("Cricketer already exists: " + cricketer.getId());
        }
        Cricketer saved = cricketerRepository.insert(cricketer);
        log.info("Created cricketer {}", saved.getId());
        return saved;
    }

    public Cricketer update(String id, Cricketer cricketer) {
        findById(id);
        cricketer.setId(id);
        cricketerRepository.update(cricketer);
        log.info("Updated cricketer {}", id);
        return cricketerRepository.findById(id).orElseThrow();
    }

    public void delete(String id) {
        findById(id);
        cricketerRepository.deleteById(id);
        log.info("Deleted cricketer {}", id);
    }
}
