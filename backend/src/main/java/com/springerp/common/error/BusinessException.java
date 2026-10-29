package com.springerp.common.error;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * A violated business rule. The message is user-facing; the code is a stable,
 * machine-readable identifier the frontend can branch on.
 */
@Getter
public class BusinessException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public BusinessException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    /** 409: the request conflicts with current state (duplicate, wrong lifecycle state...). */
    public static BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }

    /** 422: the request is well-formed but violates a business rule. */
    public static BusinessException rule(String code, String message) {
        return new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }
}
