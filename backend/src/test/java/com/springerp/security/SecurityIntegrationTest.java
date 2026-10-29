package com.springerp.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import com.springerp.support.IntegrationTest;
import com.springerp.user.User;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

class SecurityIntegrationTest extends IntegrationTest {

    private static final String REFRESH_COOKIE = "springerp_refresh";

    @Test
    void anonymousRequestsAreRejectedWith401() throws Exception {
        mvc.perform(get("/api/products"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(header().exists("X-Correlation-Id"));
    }

    @Test
    void forgedTokenIsRejected() throws Exception {
        mvc.perform(auth(get("/api/products"), "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.invalidsignature"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unknownPathsAreDeniedByDefault() throws Exception {
        mvc.perform(auth(get("/internal/anything"), tokenFor(Role.ADMIN))).andExpect(status().isForbidden());
    }

    @Test
    void rolesWithoutPermissionGet403() throws Exception {
        String employee = tokenFor(Role.EMPLOYEE);
        mvc.perform(auth(get("/api/users"), employee)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(auth(get("/api/products"), employee)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/audit-events"), employee)).andExpect(status().isForbidden());

        // Sales staff may read inventory but not financial reports or HR records.
        String sales = tokenFor(Role.SALES);
        mvc.perform(auth(get("/api/products"), sales)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/reports/sales"), sales)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/employees"), sales)).andExpect(status().isForbidden());
    }

    @Test
    void dashboardOmitsSectionsTheCallerMayNotSee() throws Exception {
        mvc.perform(auth(get("/api/dashboard"), tokenFor(Role.WAREHOUSE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.products").exists())
                .andExpect(jsonPath("$.financial").doesNotExist())
                .andExpect(jsonPath("$.recentActivity").doesNotExist());
        mvc.perform(auth(get("/api/dashboard"), tokenFor(Role.ACCOUNTANT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.financial.invoiced.current").exists())
                .andExpect(jsonPath("$.counts.employees").doesNotExist());
    }

    @Test
    void loginIssuesAccessTokenAndHttpOnlyRefreshCookie() throws Exception {
        User user = createUser(Role.SALES);
        MvcResult login = login(user.getEmail(), PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.permissions").isArray())
                .andExpect(cookie().httpOnly(REFRESH_COOKIE, true))
                .andExpect(cookie().path(REFRESH_COOKIE, "/api/auth"))
                .andReturn();
        assertThat(login.getResponse().getHeader("Set-Cookie")).contains("SameSite=Strict");
        String access = json.readTree(login.getResponse().getContentAsString()).get("accessToken").asText();
        mvc.perform(auth(get("/api/auth/me"), access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(user.getEmail()));
    }

    @Test
    void wrongPasswordAndUnknownEmailGiveTheSameAnswer() throws Exception {
        User user = createUser(Role.SALES);
        String wrong = login(user.getEmail(), "Wrong-password-1").andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        String unknown = login("nobody-" + System.nanoTime() + "@test.local", "Wrong-password-1")
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(wrong).get("detail")).isEqualTo(json.readTree(unknown).get("detail"));
    }

    @Test
    void accountLocksAfterRepeatedFailures() throws Exception {
        User user = createUser(Role.SALES);
        for (int i = 0; i < 5; i++) {
            login(user.getEmail(), "Wrong-password-1").andExpect(status().isUnauthorized());
        }
        // Even the correct password is refused while locked.
        login(user.getEmail(), PASSWORD).andExpect(status().isUnauthorized());
        assertThat(users.findById(user.getId()).orElseThrow().getLockedUntil()).isNotNull();
    }

    @Test
    void refreshRotatesTokenAndReuseRevokesTheSession() throws Exception {
        User user = createUser(Role.SALES);
        Cookie first = login(user.getEmail(), PASSWORD).andReturn().getResponse().getCookie(REFRESH_COOKIE);

        MvcResult rotated = mvc.perform(post("/api/auth/refresh").cookie(first).header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isOk()).andReturn();
        Cookie second = rotated.getResponse().getCookie(REFRESH_COOKIE);
        assertThat(second.getValue()).isNotEqualTo(first.getValue());

        // Replaying the old token (e.g. stolen) is detected and kills the whole family...
        mvc.perform(post("/api/auth/refresh").cookie(first).header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isUnauthorized());
        // ...including the legitimately rotated token.
        mvc.perform(post("/api/auth/refresh").cookie(second).header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void cookieEndpointsRequireTheAntiCsrfHeader() throws Exception {
        User user = createUser(Role.SALES);
        Cookie refresh = login(user.getEmail(), PASSWORD).andReturn().getResponse().getCookie(REFRESH_COOKIE);
        mvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_HEADER_MISSING"));
    }

    @Test
    void logoutRevokesTheRefreshToken() throws Exception {
        User user = createUser(Role.SALES);
        Cookie refresh = login(user.getEmail(), PASSWORD).andReturn().getResponse().getCookie(REFRESH_COOKIE);
        mvc.perform(post("/api/auth/logout").cookie(refresh).header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/refresh").cookie(refresh).header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void temporaryPasswordBlocksEverythingButPasswordChange() throws Exception {
        User user = createUser(Role.ADMIN);
        user.setMustChangePassword(true);
        users.save(user);
        String token = token(user);

        mvc.perform(auth(get("/api/products"), token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));

        MvcResult changed = mvc.perform(jsonBody(auth(post("/api/auth/change-password"), token),
                        Map.of("currentPassword", PASSWORD, "newPassword", "Brand-new-passw0rd")))
                .andExpect(status().isOk()).andReturn();
        String fresh = json.readTree(changed.getResponse().getContentAsString()).get("accessToken").asText();
        mvc.perform(auth(get("/api/products"), fresh)).andExpect(status().isOk());
    }

    @Test
    void weakPasswordsAreRejectedByValidation() throws Exception {
        mvc.perform(jsonBody(auth(post("/api/users"), tokenFor(Role.ADMIN)), Map.of("email", "weak@test.local",
                        "fullName", "Weak", "role", "SALES", "temporaryPassword", "short")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("temporaryPassword"));
    }

    @Test
    void administratorsCannotDeactivateThemselves() throws Exception {
        User admin = createUser(Role.ADMIN);
        mvc.perform(jsonBody(auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/users/" + admin.getId() + "/active"), token(admin)), Map.of("active", false)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("SELF_DEACTIVATION"));
    }

    private org.springframework.test.web.servlet.ResultActions login(String email, String password) throws Exception {
        return mvc.perform(jsonBody(post("/api/auth/login"), Map.of("email", email, "password", password)));
    }
}
