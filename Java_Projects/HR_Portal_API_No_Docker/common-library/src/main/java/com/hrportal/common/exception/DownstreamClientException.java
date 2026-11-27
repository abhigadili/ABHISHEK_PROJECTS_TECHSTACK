package com.hrportal.common.exception;

import org.springframework.http.HttpStatus;

/** A downstream microservice answered with a 4xx - its business answer is passed on to our caller unchanged. */
public class DownstreamClientException extends ApiException {
    public DownstreamClientException(HttpStatus status, String message) {
        super(status, "DOWNSTREAM_" + status.value(), message);
    }
}
