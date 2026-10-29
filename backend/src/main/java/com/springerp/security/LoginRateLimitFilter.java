package com.springerp.security;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springerp.common.error.GlobalExceptionHandler;
import com.springerp.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Fixed-window, per-client-IP limit on login attempts. Complements the per-account
 * lockout in AuthService: lockout stops guessing one password, this stops spraying
 * many accounts from one address. In-memory, so per instance; a multi-instance
 * deployment should move this to the reverse proxy or a shared store.
 */
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 60_000;
    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final int limit;
    private final Clock clock;
    private final ObjectMapper objectMapper;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public LoginRateLimitFilter(AppProperties properties, Clock clock, ObjectMapper objectMapper) {
        this.limit = properties.security().loginRateLimitPerMinute();
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !("POST".equals(request.getMethod()) && "/api/auth/login".equals(request.getRequestURI()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long now = clock.millis();
        if (windows.size() > MAX_TRACKED_CLIENTS) {
            windows.values().removeIf(w -> now - w.start >= WINDOW_MILLIS);
        }
        Window window = windows.compute(request.getRemoteAddr(), (ip, w) ->
                w == null || now - w.start >= WINDOW_MILLIS ? new Window(now, 1) : new Window(w.start, w.count + 1));
        if (window.count > limit) {
            long retryAfter = Math.max(1, (WINDOW_MILLIS - (now - window.start)) / 1000);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(), GlobalExceptionHandler.problem(
                    HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many login attempts. Try again in a minute."));
            return;
        }
        chain.doFilter(request, response);
    }

    private record Window(long start, int count) {
    }
}
