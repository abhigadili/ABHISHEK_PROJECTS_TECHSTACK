package com.cricket.repository;

import com.cricket.entity.Cricketer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CricketerRepository extends JpaRepository<Cricketer, String> {

    List<Cricketer> findByTeamId(String teamId);

    List<Cricketer> findByRole(String role);

    List<Cricketer> findByTeamIdAndRole(String teamId, String role);
}
