package com.hrportal.auth.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.auth.entity.Permission;

public interface PermissionRepository extends JpaRepository<Permission, String> {
    Optional<Permission> findByCode(String code);

    List<Permission> findByCodeIn(Collection<String> codes);

    List<Permission> findAllByOrderByCodeAsc();
}
