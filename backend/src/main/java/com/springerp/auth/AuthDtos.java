package com.springerp.auth;

import java.time.Instant;

import com.springerp.user.UserDtos;
import com.springerp.user.UserDtos.MeResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Size(max = 100) String password) {
    }

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 100) String currentPassword,
            @NotBlank @Pattern(regexp = UserDtos.PASSWORD_REGEX, message = UserDtos.PASSWORD_MESSAGE)
            String newPassword) {
    }

    /** Access token goes in the body (kept in memory by the SPA); the refresh token only in a cookie. */
    public record TokenResponse(String accessToken, Instant expiresAt, MeResponse user) {
    }

    /** Internal result carrying the raw refresh token to the controller, which sets the cookie. */
    public record AuthResult(TokenResponse body, String refreshToken, Instant refreshExpiresAt) {
    }
}
