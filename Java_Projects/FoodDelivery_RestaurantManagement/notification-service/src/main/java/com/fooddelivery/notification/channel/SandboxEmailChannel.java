package com.fooddelivery.notification.channel;

import com.fooddelivery.notification.client.UserContactClient;
import com.fooddelivery.notification.domain.Notification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** SANDBOX e-mail adapter: records and logs the message (recipient masked); no mail leaves this machine. */
@Component
public class SandboxEmailChannel implements NotificationChannel {
    private static final Logger log = LoggerFactory.getLogger(SandboxEmailChannel.class);
    private final boolean enabled;

    public SandboxEmailChannel(@Value("${food.notification.email-enabled:true}") boolean enabled) { this.enabled = enabled; }

    @Override public Notification.Channel channel() { return Notification.Channel.EMAIL; }
    @Override public boolean enabled() { return enabled; }
    @Override public boolean canReach(UserContactClient.Contact c) { return c != null && c.email() != null && !c.email().isBlank(); }

    @Override
    public Result deliver(Notification n, UserContactClient.Contact c) {
        String masked = c.email().replaceAll("(?<=.).(?=[^@]*@)", "*");
        log.info("[SANDBOX EMAIL] to={} subject='{}' (not actually sent)", masked, n.getTitle());
        return new Result(true, "SBX-MAIL-" + UUID.randomUUID().toString().substring(0, 8), null);
    }
}
