package com.fooddelivery.user.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.user.domain.User;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

/** UserRegisteredEventProducer + password-reset notification request. Key = user id (ordering per user). */
@Component
@EventProducer(topics = {Topics.USER_REGISTERED, Topics.NOTIFICATION_REQUESTED})
public class UserEventProducer {
    private final EventPublisher publisher;

    public UserEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    public void userRegistered(User u, String role) {
        publisher.publish(Topics.USER_REGISTERED, "UserRegistered", String.valueOf(u.getId()), String.valueOf(u.getId()),
                new Events.UserRegistered(u.getId(), u.getUsername(), u.getEmail(), u.getPhone(), u.getFullName(), role));
    }

    public void passwordResetRequested(User u, String token) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, "PasswordResetRequested", String.valueOf(u.getId()), String.valueOf(u.getId()),
                new Events.NotificationRequested(u.getId(), "Password reset requested",
                        "Use this one-time code to reset your password (valid 30 minutes): " + token, "PASSWORD_RESET", "EMAIL"));
    }
}
