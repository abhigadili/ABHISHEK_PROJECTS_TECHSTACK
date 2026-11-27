package com.example.notification.processing;

import com.example.notification.entity.Notification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Email SIMULATION (real SMTP is out of scope). Test hooks: recipients ending in "@fail.test" always fail;
 * "@flaky.test" fail on the first two attempts - useful to observe retry/backoff.
 */
@Component
public class EmailSimulator {
    /** Permanent delivery problem: retrying cannot help, so the notification goes straight to FAILED. */
    public static class NonRetryableNotificationException extends RuntimeException {
        public NonRetryableNotificationException(String m) { super(m); }
    }

    private static final Logger log = LoggerFactory.getLogger("email.simulator");

    public void send(Notification n) {
        String to = n.getRecipientEmail();
        if (to == null || to.isBlank()) throw new NonRetryableNotificationException("No recipient email address");
        if (to.endsWith("@fail.test") || (to.endsWith("@flaky.test") && n.getRetryCount() < 2)) {
            throw new IllegalStateException("Simulated SMTP failure for " + to);
        }
        log.info("EMAIL SENT to={} type={} body=\"{}\"", to, n.getNotificationType(), n.getMessage());
    }
}
