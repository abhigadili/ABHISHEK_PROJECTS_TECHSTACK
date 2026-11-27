package com.cricket.service;

import com.cricket.entity.Cricketer;
import com.cricket.exception.ResourceNotFoundException;
import com.cricket.repository.CricketerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CricketerService {

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

    @Transactional
    public Cricketer create(Cricketer cricketer) {
        return cricketerRepository.save(cricketer);
    }

    @Transactional
    public Cricketer update(String id, Cricketer cricketer) {
        Cricketer existing = findById(id);
        existing.setTeamId(cricketer.getTeamId());
        existing.setName(cricketer.getName());
        existing.setCountry(cricketer.getCountry());
        existing.setRole(cricketer.getRole());
        existing.setBattingStyle(cricketer.getBattingStyle());
        existing.setBowlingStyle(cricketer.getBowlingStyle());
        existing.setAge(cricketer.getAge());
        existing.setMatches(cricketer.getMatches());
        existing.setRuns(cricketer.getRuns());
        existing.setWickets(cricketer.getWickets());
        existing.setDescription(cricketer.getDescription());
        existing.setImage(cricketer.getImage());
        return cricketerRepository.save(existing);
    }

    @Transactional
    public void delete(String id) {
        findById(id);
        cricketerRepository.deleteById(id);
    }
}
