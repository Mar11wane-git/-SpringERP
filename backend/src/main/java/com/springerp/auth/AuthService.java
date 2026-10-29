package com.springerp.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.auth.AuthDtos.AuthResult;
import com.springerp.auth.AuthDtos.TokenResponse;
import com.springerp.common.error.BusinessException;
import com.springerp.config.AppProperties;
import com.springerp.hr.EmployeeRepository;
import com.springerp.security.CurrentUser;
import com.springerp.security.JwtService;
import com.springerp.user.User;
import com.springerp.user.UserDtos.MeResponse;
import com.springerp.user.UserRepository;
import com.springerp.user.UserService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    /** One generic message for every login failure, so responses do not reveal which accounts exist. */
    static final String LOGIN_FAILED = "Invalid email or password, or the account is temporarily locked.";

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final EmployeeRepository employees;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService audit;
    private final AppProperties.Security config;
    private final Clock clock;
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, EmployeeRepository employees,
            PasswordEncoder passwordEncoder, JwtService jwtService, AuditService audit, AppProperties properties,
            Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.employees = employees;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.audit = audit;
        this.config = properties.security();
        this.clock = clock;
        // Compared against when the email is unknown, so timing does not reveal account existence.
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional(noRollbackFor = BadCredentialsException.class)
    public AuthResult login(String rawEmail, String password, String ip, String userAgent) {
        String email = UserService.normalizeEmail(rawEmail);
        Instant now = clock.instant();
        User user = users.findByEmail(email).orElse(null);

        if (user == null) {
            passwordEncoder.matches(password, dummyHash);
            audit.recordIndependently(AuditAction.LOGIN_FAILED, null, email, "Login failed: unknown email");
            throw new BadCredentialsException(LOGIN_FAILED);
        }
        if (!user.isActive() || user.isLocked(now)) {
            passwordEncoder.matches(password, dummyHash);
            audit.recordIndependently(AuditAction.LOGIN_FAILED, user.getId(), email,
                    "Login rejected: account " + (user.isActive() ? "locked" : "inactive"));
            throw new BadCredentialsException(LOGIN_FAILED);
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            registerFailure(user, now);
            throw new BadCredentialsException(LOGIN_FAILED);
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        audit.recordIndependently(AuditAction.LOGIN_SUCCESS, user.getId(), email, "Login succeeded");
        return issueTokens(user, UUID.randomUUID().toString(), ip, userAgent);
    }

    private void registerFailure(User user, Instant now) {
        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);
        if (attempts >= config.maxFailedLogins()) {
            user.setLockedUntil(now.plus(config.lockoutDuration()));
            user.setFailedLoginAttempts(0);
            audit.recordIndependently(AuditAction.ACCOUNT_LOCKED, user.getId(), user.getEmail(),
                    "Account locked after " + attempts + " failed logins");
        } else {
            audit.recordIndependently(AuditAction.LOGIN_FAILED, user.getId(), user.getEmail(),
                    "Login failed: wrong password (attempt " + attempts + ")");
        }
    }

    /**
     * Rotates the refresh token. Presenting a token that was already rotated means it
     * was copied: the entire family is revoked and the user must sign in again.
     */
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public AuthResult refresh(String rawToken, String ip, String userAgent) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new BadCredentialsException("No active session.");
        }
        Instant now = clock.instant();
        RefreshToken token = refreshTokens.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new BadCredentialsException("No active session."));
        if (token.getRevokedAt() != null) {
            refreshTokens.revokeFamily(token.getFamilyId(), now);
            audit.recordIndependently(AuditAction.TOKEN_REUSE_DETECTED, token.getUserId(), null,
                    "Revoked refresh token was reused; session family revoked");
            throw new BadCredentialsException("Session expired. Please sign in again.");
        }
        if (token.getExpiresAt().isBefore(now)) {
            throw new BadCredentialsException("Session expired. Please sign in again.");
        }
        User user = users.findById(token.getUserId())
                .filter(User::isActive)
                .orElseThrow(() -> new BadCredentialsException("Session expired. Please sign in again."));
        token.setRevokedAt(now);
        return issueTokens(user, token.getFamilyId(), ip, userAgent);
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        refreshTokens.findByTokenHash(hash(rawToken)).ifPresent(token -> {
            if (token.getRevokedAt() == null) {
                token.setRevokedAt(clock.instant());
                audit.recordIndependently(AuditAction.LOGOUT, token.getUserId(), null, "Logged out");
            }
        });
    }

    /** Changes the caller's password, ends all other sessions and returns a fresh token pair. */
    @Transactional
    public AuthResult changePassword(String currentPassword, String newPassword, String ip, String userAgent) {
        User user = users.findById(CurrentUser.requireId())
                .orElseThrow(() -> new BadCredentialsException("No active session."));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw BusinessException.rule("WRONG_PASSWORD", "The current password is incorrect.");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw BusinessException.rule("PASSWORD_REUSED", "The new password must differ from the current one.");
        }
        Instant now = clock.instant();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        user.setPasswordChangedAt(now);
        refreshTokens.revokeAllForUser(user.getId(), now);
        audit.record(AuditAction.PASSWORD_CHANGED, "User", user.getId(), "Password changed");
        return issueTokens(user, UUID.randomUUID().toString(), ip, userAgent);
    }

    @Transactional(readOnly = true)
    public MeResponse me() {
        User user = users.findById(CurrentUser.requireId())
                .orElseThrow(() -> new BadCredentialsException("No active session."));
        return toMe(user);
    }

    private MeResponse toMe(User user) {
        Long employeeId = employees.findIdByUserId(user.getId()).orElse(null);
        return new MeResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
                user.isMustChangePassword(), user.getRole().permissions(), employeeId);
    }

    private AuthResult issueTokens(User user, String familyId, String ip, String userAgent) {
        Instant now = clock.instant();
        JwtService.IssuedToken access = jwtService.issueAccessToken(user);
        String raw = JwtService.randomToken();
        RefreshToken refresh = new RefreshToken();
        refresh.setUserId(user.getId());
        refresh.setTokenHash(hash(raw));
        refresh.setFamilyId(familyId);
        refresh.setCreatedAt(now);
        refresh.setExpiresAt(now.plus(config.jwt().refreshTokenTtl()));
        refresh.setCreatedIp(ip);
        refresh.setUserAgent(userAgent == null ? null : userAgent.substring(0, Math.min(userAgent.length(), 255)));
        refreshTokens.save(refresh);
        return new AuthResult(new TokenResponse(access.value(), access.expiresAt(), toMe(user)), raw,
                refresh.getExpiresAt());
    }

    /** Housekeeping: drop refresh tokens that expired more than a day ago. */
    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void purgeExpiredTokens() {
        refreshTokens.deleteExpiredBefore(clock.instant().minusSeconds(86_400));
    }

    static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
