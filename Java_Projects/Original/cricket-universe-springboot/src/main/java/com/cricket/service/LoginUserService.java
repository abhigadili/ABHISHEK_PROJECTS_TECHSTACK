package com.cricket.service;

import com.cricket.entity.LoginUser;
import com.cricket.exception.ResourceNotFoundException;
import com.cricket.repository.LoginUserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Read-only: this API surfaces the 'loginusers' table for completeness of DB
 * coverage but does not implement authentication (no create/update/delete),
 * and password/refresh-token fields are stripped by @JsonIgnore on the entity.
 */
@Service
public class LoginUserService {

    private final LoginUserRepository loginUserRepository;

    public LoginUserService(LoginUserRepository loginUserRepository) {
        this.loginUserRepository = loginUserRepository;
    }

    public List<LoginUser> findAll() {
        return loginUserRepository.findAll();
    }

    public LoginUser findById(Integer id) {
        return loginUserRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Login user not found: " + id));
    }
}
