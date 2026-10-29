package com.springerp.hr;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.Map;

import com.springerp.security.Role;
import com.springerp.support.IntegrationTest;
import com.springerp.user.User;
import org.junit.jupiter.api.Test;

/** Object-level authorization (IDOR) on leave requests. */
class LeaveAuthorizationTest extends IntegrationTest {

    @Test
    void employeesOnlySeeAndCancelTheirOwnRequests() throws Exception {
        String hr = tokenFor(Role.HR);
        User alice = createUser(Role.EMPLOYEE);
        User bob = createUser(Role.EMPLOYEE);
        createEmployeeLinkedTo(hr, alice);
        createEmployeeLinkedTo(hr, bob);
        String aliceToken = token(alice);
        String bobToken = token(bob);

        LocalDate monday = LocalDate.now().plusWeeks(2).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        long aliceLeave = read(mvc.perform(jsonBody(auth(post("/api/leave-requests"), aliceToken), Map.of(
                        "type", "ANNUAL", "startDate", monday.toString(), "endDate", monday.plusDays(4).toString())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.workingDays").value(5))).get("id").asLong();

        // Bob's list never contains Alice's request, even when he asks for her employee id.
        mvc.perform(auth(get("/api/leave-requests"), bobToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));

        // Bob can neither cancel nor approve it; the id is reported as not found.
        mvc.perform(auth(post("/api/leave-requests/" + aliceLeave + "/cancel"), bobToken))
                .andExpect(status().isNotFound());
        mvc.perform(auth(post("/api/leave-requests/" + aliceLeave + "/approve"), bobToken))
                .andExpect(status().isForbidden());

        // Overlapping request is refused; HR approves the original.
        mvc.perform(jsonBody(auth(post("/api/leave-requests"), aliceToken), Map.of(
                        "type", "SICK", "startDate", monday.plusDays(2).toString(),
                        "endDate", monday.plusDays(2).toString())))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LEAVE_OVERLAP"));
        mvc.perform(auth(post("/api/leave-requests/" + aliceLeave + "/approve"), hr))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
    }

    @Test
    void employeesCannotFileLeaveForSomeoneElse() throws Exception {
        String hr = tokenFor(Role.HR);
        User alice = createUser(Role.EMPLOYEE);
        User bob = createUser(Role.EMPLOYEE);
        createEmployeeLinkedTo(hr, alice);
        long bobEmployee = createEmployeeLinkedTo(hr, bob);

        LocalDate monday = LocalDate.now().plusWeeks(3).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        mvc.perform(jsonBody(auth(post("/api/leave-requests"), token(alice)), Map.of("employeeId", bobEmployee,
                        "type", "ANNUAL", "startDate", monday.toString(), "endDate", monday.toString())))
                .andExpect(status().isForbidden());
    }

    private long createEmployeeLinkedTo(String hrToken, User user) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("firstName", "Test");
        body.put("lastName", unique("Person"));
        body.put("email", unique("emp") + "@example.com");
        body.put("jobTitle", "Analyst");
        body.put("employmentType", "FULL_TIME");
        body.put("hireDate", "2024-01-15");
        body.put("userEmail", user.getEmail());
        return read(mvc.perform(jsonBody(auth(post("/api/employees"), hrToken), body))
                .andExpect(status().isCreated())).get("id").asLong();
    }
}
