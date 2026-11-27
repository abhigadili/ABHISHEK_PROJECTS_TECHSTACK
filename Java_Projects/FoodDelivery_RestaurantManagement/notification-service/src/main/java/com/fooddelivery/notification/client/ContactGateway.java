package com.fooddelivery.notification.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Contact lookup with graceful degradation: if user-service is down, in-app notifications still work (e-mail/SMS skipped). */
@Component
public class ContactGateway {
    private static final Logger log = LoggerFactory.getLogger(ContactGateway.class);
    private final UserContactClient client;

    public ContactGateway(UserContactClient client) { this.client = client; }

    @CircuitBreaker(name = "user", fallbackMethod = "none")
    @Retry(name = "user")
    public UserContactClient.Contact contact(Long userId) { return client.contact(userId); }

    UserContactClient.Contact none(Long userId, Throwable t) {
        log.warn("Contact lookup for user {} unavailable ({}); sending in-app only", userId, t.toString());
        return null;
    }
}
