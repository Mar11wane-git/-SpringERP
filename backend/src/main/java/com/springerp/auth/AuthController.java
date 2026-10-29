package com.springerp.auth;

import java.time.Duration;
import java.time.Instant;

import com.springerp.auth.AuthDtos.AuthResult;
import com.springerp.auth.AuthDtos.ChangePasswordRequest;
import com.springerp.auth.AuthDtos.LoginRequest;
import com.springerp.auth.AuthDtos.TokenResponse;
import com.springerp.common.error.BusinessException;
import com.springerp.config.AppProperties;
import com.springerp.user.UserDtos.MeResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Authentication")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "springerp_refresh";
    static final String CSRF_HEADER = "X-Requested-With";

    private final AuthService service;
    private final boolean secureCookie;

    public AuthController(AuthService service, AppProperties properties) {
        this.service = service;
        this.secureCookie = properties.security().refreshCookieSecure();
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return withCookie(service.login(request.email(), request.password(), http.getRemoteAddr(),
                http.getHeader(HttpHeaders.USER_AGENT)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken, HttpServletRequest http) {
        requireCsrfHeader(http);
        return withCookie(service.refresh(refreshToken, http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken, HttpServletRequest http) {
        requireCsrfHeader(http);
        service.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString())
                .build();
    }

    @PostMapping("/change-password")
    public ResponseEntity<TokenResponse> changePassword(@Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest http) {
        return withCookie(service.changePassword(request.currentPassword(), request.newPassword(),
                http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT)));
    }

    @GetMapping("/me")
    public MeResponse me() {
        return service.me();
    }

    private ResponseEntity<TokenResponse> withCookie(AuthResult result) {
        Duration maxAge = Duration.between(Instant.now(), result.refreshExpiresAt());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(result.refreshToken(), maxAge).toString())
                .body(result.body());
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(maxAge)
                .build();
    }

    /** Cookie-authenticated endpoints require a header that cross-site HTML forms cannot set. */
    private static void requireCsrfHeader(HttpServletRequest http) {
        if (http.getHeader(CSRF_HEADER) == null) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "CSRF_HEADER_MISSING",
                    "Missing " + CSRF_HEADER + " header.");
        }
    }
}
