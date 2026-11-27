package com.cricket.repository;

import com.cricket.entity.LoginUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LoginUserRepository extends JpaRepository<LoginUser, Integer> {

    Optional<LoginUser> findByEmail(String email);
}
