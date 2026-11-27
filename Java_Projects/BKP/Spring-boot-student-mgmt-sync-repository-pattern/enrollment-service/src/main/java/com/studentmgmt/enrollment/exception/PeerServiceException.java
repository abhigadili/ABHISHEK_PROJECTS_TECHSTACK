package com.studentmgmt.enrollment.exception;

/** Thrown when a synchronous call to student-service, course-service or notification-service fails. */
public class PeerServiceException extends RuntimeException {

    public PeerServiceException(String serviceName, String message) {
        super("[" + serviceName + "] " + message);
    }
}
