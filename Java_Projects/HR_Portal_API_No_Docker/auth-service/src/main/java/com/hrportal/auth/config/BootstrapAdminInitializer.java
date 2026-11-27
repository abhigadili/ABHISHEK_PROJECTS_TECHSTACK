package com.hrportal.auth.config;

import java.time.Instant;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.hrportal.auth.entity.UserAccount;
import com.hrportal.auth.repository.RoleRepository;
import com.hrportal.auth.repository.UserAccountRepository;

/**
 * Creates the first SUPER_ADMIN from environment variables (HR_BOOTSTRAP_ADMIN_*). No default credentials exist in
 * source or migrations; if the variables are not set nothing is created and a warning is logged.
 */
@Component
public class BootstrapAdminInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminInitializer.class);
    private final UserAccountRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;
    private final TransactionTemplate tx;
    private final String username;
    private final String email;
    private final String password;

    public BootstrapAdminInitializer(UserAccountRepository users, RoleRepository roles, PasswordEncoder encoder, TransactionTemplate tx,
                                     @Value("${hr.auth.bootstrap.username:}") String username,
                                     @Value("${hr.auth.bootstrap.email:}") String email,
                                     @Value("${hr.auth.bootstrap.password:}") String password) {
        this.users = users;
        this.roles = roles;
        this.encoder = encoder;
        this.tx = tx;
        this.username = username;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (username.isBlank() || password.isBlank() || email.isBlank()) {
            log.warn("HR_BOOTSTRAP_ADMIN_USERNAME / _EMAIL / _PASSWORD not set - no initial super admin created");
            return;
        }
        tx.executeWithoutResult(s -> {
            if (users.existsByUsernameIgnoreCase(username)) return;
            UserAccount u = new UserAccount();
            u.setUsername(username);
            u.setEmail(email.toLowerCase());
            u.setPasswordHash(encoder.encode(password));
            u.setPasswordChangedAt(Instant.now());
            u.setRoles(Set.copyOf(roles.findByNameIn(Set.of("SUPER_ADMIN"))));
            users.save(u);
            log.info("Initial super admin '{}' created", username);
        });
    }
}
