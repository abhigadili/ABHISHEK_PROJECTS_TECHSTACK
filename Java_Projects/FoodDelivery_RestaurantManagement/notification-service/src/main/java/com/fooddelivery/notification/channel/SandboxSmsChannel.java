package com.fooddelivery.notification.channel;

import com.fooddelivery.notification.client.UserContactClient;
import com.fooddelivery.notification.domain.Notification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** SANDBOX SMS adapter: records and logs the message (number masked); no SMS is sent. */
@Component
public class SandboxSmsChannel implements NotificationChannel {
    private static final Logger log = LoggerFactory.getLogger(SandboxSmsChannel.class);
    private final boolean enabled;

    public SandboxSmsChannel(@Value("${food.notification.sms-enabled:true}") boolean enabled) { this.enabled = enabled; }

    @Override public Notification.Channel channel() { return Notification.Channel.SMS; }
    @Override public boolean enabled() { return enabled; }
    @Override public boolean canReach(UserContactClient.Contact c) { return c != null && c.phone() != null && !c.phone().isBlank(); }

    @Override
    public Result deliver(Notification n, UserContactClient.Contact c) {
        String p = c.phone();
        String masked = p.length() > 4 ? "*".repeat(p.length() - 4) + p.substring(p.length() - 4) : "****";
        log.info("[SANDBOX SMS] to={} text='{}' (not actually sent)", masked, n.getTitle());
        return new Result(true, "SBX-SMS-" + UUID.randomUUID().toString().substring(0, 8), null);
    }
}
