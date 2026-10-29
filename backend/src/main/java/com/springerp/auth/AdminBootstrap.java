package com.springerp.auth;

import java.security.SecureRandom;
import java.time.Clock;

import com.springerp.config.AppProperties;
import com.springerp.security.Role;
import com.springerp.user.User;
import com.springerp.user.UserDtos;
import com.springerp.user.UserRepository;
import com.springerp.user.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first administrator when the users table is empty. Credentials come
 * from APP_BOOTSTRAP_ADMIN_EMAIL / APP_BOOTSTRAP_ADMIN_PASSWORD; nothing is hardcoded.
 */
@Component
@Order(1)
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties.Bootstrap config;
    private final Clock clock;

    public AdminBootstrap(UserRepository users, PasswordEncoder passwordEncoder, AppProperties properties,
            Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.config = properties.bootstrap();
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        if (config.adminEmail() == null || config.adminEmail().isBlank()) {
            log.warn("No users exist and APP_BOOTSTRAP_ADMIN_EMAIL is not set: nobody can sign in yet.");
            return;
        }
        String password = config.adminPassword();
        boolean generated = false;
        if (password == null || password.isBlank()) {
            if (!config.generatePasswordIfMissing()) {
                log.warn("No users exist and APP_BOOTSTRAP_ADMIN_PASSWORD is not set: no administrator created.");
                return;
            }
            password = generatePassword();
            generated = true;
        } else if (!password.matches(UserDtos.PASSWORD_REGEX)) {
            throw new IllegalStateException("APP_BOOTSTRAP_ADMIN_PASSWORD does not meet the password policy: "
                    + UserDtos.PASSWORD_MESSAGE);
        }

        User admin = new User();
        admin.setEmail(UserService.normalizeEmail(config.adminEmail()));
        admin.setFullName("Administrator");
        admin.setRole(Role.ADMIN);
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setMustChangePassword(generated);
        admin.setPasswordChangedAt(clock.instant());
        users.save(admin);

        if (generated) {
            // Local profile only (generate-password-if-missing). Shown once; must be changed at first login.
            log.warn("Created administrator {} with one-time password: {}", admin.getEmail(), password);
        } else {
            log.info("Created administrator {}", admin.getEmail());
        }
    }

    private static String generatePassword() {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder("A1");
        for (int i = 0; i < 14; i++) {
            sb.append(alphabet.charAt(random.nextInt(alphabet.length())));
        }
        return sb.toString();
    }
}
