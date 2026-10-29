package com.springerp.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springerp.security.JwtService;
import com.springerp.security.Role;
import com.springerp.user.User;
import com.springerp.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Full application on an in-memory H2 database migrated by the real Flyway scripts
 * (Hibernate validates the entities against them at startup). Tests share the
 * database, so every test creates its own uniquely named data.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTest {

    public static final String PASSWORD = "Passw0rd-for-tests";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    @Autowired
    protected UserRepository users;

    @Autowired
    protected JwtService jwtService;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    protected static String unique(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 8);
    }

    protected User createUser(Role role) {
        User user = new User();
        user.setEmail(unique(role.name().toLowerCase() + "-") + "@test.local");
        user.setFullName("Test " + role);
        user.setRole(role);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return users.save(user);
    }

    protected String tokenFor(Role role) {
        return jwtService.issueAccessToken(createUser(role)).value();
    }

    protected String token(User user) {
        return jwtService.issueAccessToken(user).value();
    }

    protected static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request, String token) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    protected MockHttpServletRequestBuilder jsonBody(MockHttpServletRequestBuilder request, Object body)
            throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    protected JsonNode read(org.springframework.test.web.servlet.ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    // ---- fixtures created through the API, exactly like the frontend does ----

    protected long createCustomer(String adminToken) throws Exception {
        var body = java.util.Map.of("name", unique("Customer "), "city", "Testville", "email",
                unique("c") + "@example.com");
        return read(mvc.perform(jsonBody(auth(post("/api/customers"), adminToken), body))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    protected long createProduct(String adminToken, int initialQuantity, String unitPrice) throws Exception {
        var body = new java.util.HashMap<String, Object>();
        body.put("sku", unique("SKU-"));
        body.put("name", unique("Product "));
        body.put("unit", "pcs");
        body.put("unitPrice", new BigDecimal(unitPrice));
        body.put("costPrice", new BigDecimal("1.00"));
        body.put("taxRate", new BigDecimal("20.00"));
        body.put("reorderLevel", 2);
        body.put("initialQuantity", initialQuantity);
        return read(mvc.perform(jsonBody(auth(post("/api/products"), adminToken), body))
                .andExpect(status().isCreated())).get("id").asLong();
    }
}
