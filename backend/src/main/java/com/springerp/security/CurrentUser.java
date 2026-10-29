package com.springerp.security;

import java.util.Optional;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Static accessors for the authenticated principal carried by the access token. */
public final class CurrentUser {

    private CurrentUser() {
    }

    private static Optional<Jwt> jwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            return Optional.of(token.getToken());
        }
        return Optional.empty();
    }

    public static Optional<Long> id() {
        return jwt().map(j -> Long.valueOf(j.getSubject()));
    }

    public static Long requireId() {
        return id().orElseThrow(() -> new IllegalStateException("No authenticated user"));
    }

    public static Optional<String> email() {
        return jwt().map(j -> j.getClaimAsString(JwtService.CLAIM_EMAIL));
    }

    /** Identifier recorded in "created_by" style columns; "system" for background work. */
    public static String label() {
        return email().orElse("system");
    }

    public static boolean has(Permission permission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(permission.name()));
    }
}
