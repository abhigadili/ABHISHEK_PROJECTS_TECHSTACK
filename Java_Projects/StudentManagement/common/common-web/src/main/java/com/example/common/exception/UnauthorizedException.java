package com.example.common.exception;

/** HTTP 401: bad credentials / invalid refresh token. */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) { super(message); }
}
