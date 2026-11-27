package com.hospital.common.web;

import org.springframework.http.HttpStatus;

/** A downstream service answered with a 4xx other than 404 - the caller's request is at fault, so the
 *  status is passed through and the circuit breaker does not count it as a failure. */
public class DownstreamClientException extends ApiException {
    public DownstreamClientException(HttpStatus status, String message) {
        super(status, message);
    }
}
