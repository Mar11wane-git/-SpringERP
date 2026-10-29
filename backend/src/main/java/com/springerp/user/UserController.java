package com.springerp.user;

import com.springerp.common.api.PageResponse;
import com.springerp.security.Role;
import com.springerp.user.UserDtos.CreateUserRequest;
import com.springerp.user.UserDtos.ResetPasswordRequest;
import com.springerp.user.UserDtos.SetActiveRequest;
import com.springerp.user.UserDtos.UpdateUserRequest;
import com.springerp.user.UserDtos.UserResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Users")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService service;

    @GetMapping
    @PreAuthorize("hasAuthority('USER_READ')")
    public PageResponse<UserResponse> list(@RequestParam(required = false) String search,
            @RequestParam(required = false) Role role, @RequestParam(required = false) Boolean active,
            Pageable pageable) {
        return service.search(search, role, active, pageable);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_READ')")
    public UserResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('USER_WRITE')")
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_WRITE')")
    public UserResponse update(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasAuthority('USER_WRITE')")
    public UserResponse setActive(@PathVariable Long id, @Valid @RequestBody SetActiveRequest request) {
        return service.setActive(id, request.active());
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasAuthority('USER_WRITE')")
    public UserResponse resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest request) {
        return service.resetPassword(id, request.temporaryPassword());
    }
}
