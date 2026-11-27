package com.fooddelivery.user.service;

import com.fooddelivery.user.domain.Role;
import com.fooddelivery.user.domain.User;
import com.fooddelivery.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates the first SUPER_ADMIN from environment variables (only when the user table is empty). */
@Component
public class BootstrapAdminRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminRunner.class);
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String email;
    private final String password;

    public BootstrapAdminRunner(UserRepository users, PasswordEncoder encoder,
                                @Value("${food.auth.bootstrap-admin-email:}") String email,
                                @Value("${food.auth.bootstrap-admin-password:}") String password) {
        this.users = users;
        this.encoder = encoder;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank() || users.existsByEmailIgnoreCase(email)) return;
        User u = new User();
        u.setUsername("superadmin");
        u.setEmail(email.toLowerCase());
        u.setPasswordHash(encoder.encode(password));
        u.setFullName("Platform Super Admin");
        u.getRoles().add(Role.SUPER_ADMIN);
        users.save(u);
        log.info("Bootstrap SUPER_ADMIN created (username=superadmin)");
    }
}
