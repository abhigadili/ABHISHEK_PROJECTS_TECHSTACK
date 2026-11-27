package com.hrportal.auth.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.auth.entity.Role;

public interface RoleRepository extends JpaRepository<Role, String> {
    @EntityGraph(attributePaths = "permissions")
    Optional<Role> findByName(String name);

    List<Role> findByNameIn(Collection<String> names);

    @EntityGraph(attributePaths = "permissions")
    List<Role> findAllByOrderByNameAsc();
}
