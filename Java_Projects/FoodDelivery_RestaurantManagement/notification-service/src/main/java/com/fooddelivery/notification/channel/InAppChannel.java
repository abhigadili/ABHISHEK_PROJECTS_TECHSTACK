package com.fooddelivery.notification.channel;

import com.fooddelivery.notification.client.UserContactClient;
import com.fooddelivery.notification.domain.Notification;
import org.springframework.stereotype.Component;

/** In-app: the persisted row IS the delivery (the UI reads it). Always on. */
@Component
public class InAppChannel implements NotificationChannel {
    @Override public Notification.Channel channel() { return Notification.Channel.IN_APP; }
    @Override public boolean enabled() { return true; }
    @Override public boolean canReach(UserContactClient.Contact c) { return true; }
    @Override public Result deliver(Notification n, UserContactClient.Contact c) { return new Result(true, "inapp-" + n.getId(), null); }
}
