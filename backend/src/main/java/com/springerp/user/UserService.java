package com.springerp.user;

import java.time.Clock;
import java.util.Locale;
import java.util.Set;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.auth.RefreshTokenRepository;
import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.security.CurrentUser;
import com.springerp.security.Role;
import com.springerp.user.UserDtos.CreateUserRequest;
import com.springerp.user.UserDtos.UpdateUserRequest;
import com.springerp.user.UserDtos.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final Set<String> SORTABLE = Set.of("email", "fullName", "role", "createdAt", "lastLoginAt");

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> search(String search, Role role, Boolean active, Pageable pageable) {
        Pageable page = Pagination.sanitize(pageable, SORTABLE, Sort.by("fullName"));
        return PageResponse.of(users.search(Pagination.likePattern(search), role, active, page),
                u -> UserResponse.from(u, clock.instant()));
    }

    @Transactional(readOnly = true)
    public UserResponse get(Long id) {
        return UserResponse.from(find(id), clock.instant());
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw BusinessException.conflict("EMAIL_TAKEN", "A user with this email already exists.");
        }
        User user = new User();
        user.setEmail(email);
        user.setFullName(request.fullName().trim());
        user.setRole(request.role());
        user.setPasswordHash(passwordEncoder.encode(request.temporaryPassword()));
        user.setMustChangePassword(true);
        user.setPasswordChangedAt(clock.instant());
        users.save(user);
        audit.record(AuditAction.USER_CREATED, "User", user.getId(),
                "Created user " + email + " with role " + request.role());
        return UserResponse.from(user, clock.instant());
    }

    @Transactional
    public UserResponse update(Long id, UpdateUserRequest request) {
        User user = find(id);
        if (user.getRole() == Role.ADMIN && request.role() != Role.ADMIN) {
            guardLastAdmin(user);
        }
        Role previous = user.getRole();
        user.setFullName(request.fullName().trim());
        user.setRole(request.role());
        if (previous != request.role()) {
            // Outstanding sessions carry the old role; force re-authentication.
            refreshTokens.revokeAllForUser(user.getId(), clock.instant());
            audit.record(AuditAction.USER_ROLE_CHANGED, "User", id,
                    "Role of " + user.getEmail() + " changed from " + previous + " to " + request.role());
        }
        return UserResponse.from(user, clock.instant());
    }

    @Transactional
    public UserResponse setActive(Long id, boolean active) {
        User user = find(id);
        if (!active) {
            if (user.getId().equals(CurrentUser.id().orElse(null))) {
                throw BusinessException.rule("SELF_DEACTIVATION", "You cannot deactivate your own account.");
            }
            if (user.getRole() == Role.ADMIN) {
                guardLastAdmin(user);
            }
            refreshTokens.revokeAllForUser(user.getId(), clock.instant());
        } else {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(null);
        }
        user.setActive(active);
        audit.record(active ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED, "User", id,
                (active ? "Activated " : "Deactivated ") + user.getEmail());
        return UserResponse.from(user, clock.instant());
    }

    /** Administrator-initiated reset: sets a temporary password the user must replace at next login. */
    @Transactional
    public UserResponse resetPassword(Long id, String temporaryPassword) {
        User user = find(id);
        user.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        user.setMustChangePassword(true);
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setPasswordChangedAt(clock.instant());
        refreshTokens.revokeAllForUser(user.getId(), clock.instant());
        audit.record(AuditAction.PASSWORD_RESET, "User", id, "Password reset for " + user.getEmail());
        return UserResponse.from(user, clock.instant());
    }

    private void guardLastAdmin(User user) {
        if (user.isActive() && users.countByRoleAndActiveTrue(Role.ADMIN) <= 1) {
            throw BusinessException.rule("LAST_ADMIN", "At least one active administrator must remain.");
        }
    }

    private User find(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User", id));
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
