package com.cricket.repository;

import com.cricket.model.Cricketer;

import java.util.List;
import java.util.Optional;

public interface CricketerRepository {

    List<Cricketer> findAll();

    List<Cricketer> findByTeamId(String teamId);

    List<Cricketer> findByRole(String role);

    List<Cricketer> findByTeamIdAndRole(String teamId, String role);

    Optional<Cricketer> findById(String id);

    boolean existsById(String id);

    Cricketer insert(Cricketer cricketer);

    int update(Cricketer cricketer);

    int deleteById(String id);
}
