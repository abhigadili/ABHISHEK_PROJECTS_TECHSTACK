package com.fooddelivery.notification.channel;

import com.fooddelivery.notification.client.UserContactClient;
import com.fooddelivery.notification.domain.Notification;

/** Notification channel abstraction: each adapter delivers one {@link Notification.Channel}. */
public interface NotificationChannel {
    record Result(boolean sent, String providerRef, String error) {}

    Notification.Channel channel();
    boolean enabled();
    /** @return null when this channel cannot reach the user (e.g. no phone number). */
    boolean canReach(UserContactClient.Contact contact);
    Result deliver(Notification n, UserContactClient.Contact contact);
}
