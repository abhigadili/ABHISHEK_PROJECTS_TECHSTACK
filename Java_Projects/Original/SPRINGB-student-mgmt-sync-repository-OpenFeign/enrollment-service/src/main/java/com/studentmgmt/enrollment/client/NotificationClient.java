package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.NotificationSendRequest;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import feign.FeignException;
import org.springframework.stereotype.Component;

/**
 * Thin wrapper around NotificationFeignClient. Called after a payment
 * succeeds — PaymentService waits for this call to return (or fail) before
 * returning to its own caller, same as the RestTemplate variant.
 */
@Component
public class NotificationClient {

    private final NotificationFeignClient notificationFeignClient;

    public NotificationClient(NotificationFeignClient notificationFeignClient) {
        this.notificationFeignClient = notificationFeignClient;
    }

    public void send(NotificationSendRequest request) {
        try {
            notificationFeignClient.send(request);
        } catch (FeignException e) {
            throw new PeerServiceException("notification-service",
                    "Unable to send notification: " + e.getMessage());
        }
    }
}
