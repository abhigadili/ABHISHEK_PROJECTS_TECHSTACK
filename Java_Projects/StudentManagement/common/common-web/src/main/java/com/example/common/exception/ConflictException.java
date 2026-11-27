package com.example.common.exception;

/** HTTP 409: duplicate, optimistic-lock conflict, no seats left, etc. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) { super(message); }
}
