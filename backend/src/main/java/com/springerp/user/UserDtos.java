package com.springerp.user;

import java.time.Instant;
import java.util.Set;

import com.springerp.security.Permission;
import com.springerp.security.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** API contracts for user management. Password hashes never leave the server. */
public final class UserDtos {

    /** Shared password policy: 10-100 characters with at least one letter and one digit. */
    public static final String PASSWORD_REGEX = "^(?=.*[A-Za-z])(?=.*\\d).{10,100}$";
    public static final String PASSWORD_MESSAGE =
            "Password must be 10-100 characters and contain at least one letter and one digit.";

    private UserDtos() {
    }

    public record UserResponse(Long id, String email, String fullName, Role role, boolean active,
            boolean mustChangePassword, boolean locked, Instant lastLoginAt, Instant createdAt) {

        public static UserResponse from(User user, Instant now) {
            return new UserResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
                    user.isActive(), user.isMustChangePassword(), user.isLocked(now), user.getLastLoginAt(),
                    user.getCreatedAt());
        }
    }

    /** The authenticated user's own profile plus the permissions the UI should honour. */
    public record MeResponse(Long id, String email, String fullName, Role role, boolean mustChangePassword,
            Set<Permission> permissions, Long employeeId) {
    }

    public record CreateUserRequest(
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Size(max = 150) String fullName,
            @NotNull Role role,
            @NotBlank @Pattern(regexp = PASSWORD_REGEX, message = PASSWORD_MESSAGE) String temporaryPassword) {
    }

    public record UpdateUserRequest(
            @NotBlank @Size(max = 150) String fullName,
            @NotNull Role role) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Pattern(regexp = PASSWORD_REGEX, message = PASSWORD_MESSAGE) String temporaryPassword) {
    }

    public record SetActiveRequest(@NotNull Boolean active) {
    }
}
