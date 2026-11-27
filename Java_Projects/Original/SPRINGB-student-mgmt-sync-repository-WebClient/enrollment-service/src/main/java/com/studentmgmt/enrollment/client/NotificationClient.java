package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.NotificationSendRequest;
import com.studentmgmt.enrollment.exception.PeerServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientException;

/**
 * WebClient client for notification-service. Called after a payment
 * succeeds — .block() here means PaymentService genuinely waits for this
 * call to finish (or fail) before it can return to its own caller, same as
 * the RestTemplate variant.
 */
@Component
public class NotificationClient {

    private final WebClient webClient;

    public NotificationClient(WebClient.Builder webClientBuilder,
                               @Value("${services.notification.base-url}") String baseUrl) {
        this.webClient = webClientBuilder.baseUrl(baseUrl).build();
    }

    public void send(NotificationSendRequest request) {
        try {
            webClient.post()
                    .uri("/api/notifications/send")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(Object.class)
                    .block();
        } catch (WebClientException e) {
            throw new PeerServiceException("notification-service",
                    "Unable to send notification: " + e.getMessage());
        }
    }
}
