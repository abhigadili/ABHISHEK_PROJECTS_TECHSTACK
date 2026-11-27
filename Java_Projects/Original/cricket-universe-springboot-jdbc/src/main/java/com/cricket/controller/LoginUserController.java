package com.cricket.controller;

import com.cricket.model.LoginUser;
import com.cricket.service.LoginUserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read-only — see LoginUserService for why there is no create/update/delete here. */
@RestController
@RequestMapping("/api/login-users")
public class LoginUserController {

    private final LoginUserService loginUserService;

    public LoginUserController(LoginUserService loginUserService) {
        this.loginUserService = loginUserService;
    }

    @GetMapping
    public List<LoginUser> findAll() {
        return loginUserService.findAll();
    }

    @GetMapping("/{id}")
    public LoginUser findById(@PathVariable Integer id) {
        return loginUserService.findById(id);
    }
}
