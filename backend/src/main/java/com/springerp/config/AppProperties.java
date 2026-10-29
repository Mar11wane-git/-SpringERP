package com.springerp.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Type-safe view of the {@code app.*} configuration tree. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Security security, Bootstrap bootstrap, Storage storage, DemoData demoData) {

    public record Security(
            Jwt jwt,
            boolean allowEphemeralSecret,
            boolean refreshCookieSecure,
            List<String> corsAllowedOrigins,
            int maxFailedLogins,
            Duration lockoutDuration,
            int loginRateLimitPerMinute) {
    }

    public record Jwt(String secret, String issuer, Duration accessTokenTtl, Duration refreshTokenTtl) {
    }

    public record Bootstrap(String adminEmail, String adminPassword, boolean generatePasswordIfMissing) {
    }

    public record Storage(String documentsDir) {
    }

    public record DemoData(boolean enabled, String userPassword) {
    }
}
