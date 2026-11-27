package com.example.student.config;

import com.example.student.entity.Role;
import com.example.student.entity.UserAccount;
import com.example.student.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Seeds the first ADMIN account (password from ADMIN_PASSWORD, stored as BCrypt hash) when it does not exist yet. */
@Component
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    private final UserAccountRepository users;
    private final PasswordEncoder encoder;
    private final String username, email, password;

    public AdminBootstrap(UserAccountRepository users, PasswordEncoder encoder,
                          @Value("${app.bootstrap.admin-username}") String username,
                          @Value("${app.bootstrap.admin-email}") String email,
                          @Value("${app.bootstrap.admin-password}") String password) {
        this.users = users; this.encoder = encoder; this.username = username; this.email = email; this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.existsByUsernameIgnoreCase(username)) return;
        UserAccount u = new UserAccount();
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        u.setRole(Role.ADMIN);
        users.save(u);
        log.info("Bootstrapped ADMIN account '{}'", username);
    }
}
