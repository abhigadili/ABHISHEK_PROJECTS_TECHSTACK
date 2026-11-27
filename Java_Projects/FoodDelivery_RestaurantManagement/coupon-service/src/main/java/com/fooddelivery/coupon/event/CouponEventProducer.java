package com.fooddelivery.coupon.event;

import com.fooddelivery.common.kafka.EventProducer;
import com.fooddelivery.common.kafka.EventPublisher;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import org.springframework.stereotype.Component;

@Component
@EventProducer(topics = Topics.COUPON_REDEEMED)
public class CouponEventProducer {
    private final EventPublisher publisher;

    public CouponEventProducer(EventPublisher publisher) { this.publisher = publisher; }

    public void redeemed(Events.CouponRedeemed e) {
        publisher.publish(Topics.COUPON_REDEEMED, "CouponRedeemed", String.valueOf(e.orderId()), String.valueOf(e.orderId()), e);
    }
}
