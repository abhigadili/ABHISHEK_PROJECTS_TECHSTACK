package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.NotificationSendRequest;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * Synchronous (blocking) HTTP client for notification-service. Called after
 * a payment succeeds — PaymentService waits for this call to return (or fail)
 * before returning to its own caller.
 */
@Component
public class NotificationClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public NotificationClient(RestTemplate restTemplate,
                               @Value("${services.notification.base-url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    public void send(NotificationSendRequest request) {
        try {
            restTemplate.postForObject(baseUrl + "/api/notifications/send", request, Object.class);
        } catch (RestClientException e) {
            throw new PeerServiceException("notification-service",
                    "Unable to send notification: " + e.getMessage());
        }
    }
}
