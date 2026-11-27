package com.fooddelivery.order.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * The order lifecycle. Each constant lists the ONLY states it may move to; everything else is rejected by
 * {@link #canMoveTo(OrderStatus)}. The frontend never sets a status: it asks for an action and the backend decides.
 *
 * <pre>
 * CREATED -> PAYMENT_PENDING -> CONFIRMED -> RESTAURANT_ACCEPTED -> PREPARING -> READY_FOR_PICKUP
 *        -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
 * side exits: PAYMENT_FAILED, REJECTED, CANCELLED -> REFUND_PENDING -> REFUNDED
 * </pre>
 */
public enum OrderStatus {
    CREATED, PAYMENT_PENDING, PAYMENT_FAILED, CONFIRMED, RESTAURANT_ACCEPTED, REJECTED, PREPARING, READY_FOR_PICKUP,
    PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, REFUND_PENDING, REFUNDED;

    public Set<OrderStatus> next() {
        return switch (this) {
            case CREATED -> EnumSet.of(PAYMENT_PENDING, CANCELLED);
            case PAYMENT_PENDING -> EnumSet.of(CONFIRMED, PAYMENT_FAILED, CANCELLED);
            case CONFIRMED -> EnumSet.of(RESTAURANT_ACCEPTED, REJECTED, CANCELLED);
            case RESTAURANT_ACCEPTED -> EnumSet.of(PREPARING, REJECTED, CANCELLED);
            case PREPARING -> EnumSet.of(READY_FOR_PICKUP);
            case READY_FOR_PICKUP -> EnumSet.of(PICKED_UP);
            case PICKED_UP -> EnumSet.of(OUT_FOR_DELIVERY);
            case OUT_FOR_DELIVERY -> EnumSet.of(DELIVERED);
            case REJECTED, CANCELLED -> EnumSet.of(REFUND_PENDING);
            case REFUND_PENDING -> EnumSet.of(REFUNDED);
            case PAYMENT_FAILED, DELIVERED, REFUNDED -> EnumSet.noneOf(OrderStatus.class);
        };
    }

    public boolean canMoveTo(OrderStatus target) { return next().contains(target); }

    /** Customer may cancel until the kitchen starts cooking. */
    public boolean customerCancellable() { return this == PAYMENT_PENDING || this == CONFIRMED || this == RESTAURANT_ACCEPTED; }

    public boolean isPaid() {
        return switch (this) {
            case CONFIRMED, RESTAURANT_ACCEPTED, PREPARING, READY_FOR_PICKUP, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED -> true;
            default -> false;
        };
    }
}
