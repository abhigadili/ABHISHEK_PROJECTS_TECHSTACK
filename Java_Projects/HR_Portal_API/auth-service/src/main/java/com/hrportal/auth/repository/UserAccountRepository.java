package com.hrportal.auth.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.auth.entity.AccountStatus;
import com.hrportal.auth.entity.UserAccount;

public interface UserAccountRepository extends JpaRepository<UserAccount, String> {

    /** Entity graph fetches roles + permissions in the same query (avoids N+1 while building the token). */
    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<UserAccount> findByUsernameIgnoreCase(String username);

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<UserAccount> findWithRolesById(String id);

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<UserAccount> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<UserAccount> findByEmployeeId(String employeeId);

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    java.util.List<UserAccount> findByIdIn(java.util.Collection<String> ids);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    @Query("select u from UserAccount u where (:q is null or lower(u.username) like lower(concat('%', :q, '%')) "
            + "or lower(u.email) like lower(concat('%', :q, '%'))) and (:status is null or u.status = :status)")
    Page<UserAccount> search(@Param("q") String q, @Param("status") AccountStatus status, Pageable pageable);
}
