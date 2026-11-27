package com.fooddelivery.coupon.event;

import com.fooddelivery.common.kafka.EventConsumerSupport;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.coupon.service.CouponService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Consumer group "coupon-service-group": a confirmed (paid) order consumes the coupon. */
@Component
public class CouponEventConsumer {
    private final EventConsumerSupport support;
    private final CouponService coupons;

    public CouponEventConsumer(EventConsumerSupport support, CouponService coupons) {
        this.support = support;
        this.coupons = coupons;
    }

    @KafkaListener(topics = Topics.ORDER_CONFIRMED, groupId = "${spring.application.name}-group")
    public void onOrderConfirmed(ConsumerRecord<String, String> rec) {
        support.handle(rec, "CouponEventConsumer", Events.OrderConfirmed.class, (env, e) -> coupons.redeem(e));
    }
}
