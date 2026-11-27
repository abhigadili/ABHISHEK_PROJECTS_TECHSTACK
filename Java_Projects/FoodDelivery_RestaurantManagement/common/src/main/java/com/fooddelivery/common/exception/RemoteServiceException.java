package com.fooddelivery.common.exception;

/** A synchronous call to another microservice failed (Feign or WebClient). */
public class RemoteServiceException extends RuntimeException {
    private final int status;
    private final String service;

    public RemoteServiceException(String service, int status, String message) {
        super(message);
        this.service = service;
        this.status = status;
    }

    public int getStatus() { return status; }
    public String getService() { return service; }
    public boolean isClientError() { return status >= 400 && status < 500; }
}
