package com.fooddelivery.common.kafka;

import java.util.List;
import java.util.Map;

/** The topic catalogue. Every constant is produced and consumed somewhere in the code base (see docs/kafka). */
public final class Topics {
    public static final String USER_REGISTERED = "user.registered";
    public static final String RESTAURANT_REGISTERED = "restaurant.registered";
    public static final String RESTAURANT_APPROVED = "restaurant.approved";
    public static final String MENU_ITEM_CREATED = "menu.item.created";
    public static final String MENU_ITEM_UPDATED = "menu.item.updated";
    public static final String INVENTORY_UPDATED = "inventory.updated";
    public static final String INVENTORY_LOW_STOCK = "inventory.low-stock";
    public static final String INVENTORY_RESERVATION_FAILED = "inventory.reservation-failed";
    public static final String ORDER_CREATED = "order.created";
    public static final String ORDER_CONFIRMED = "order.confirmed";
    public static final String ORDER_CANCELLED = "order.cancelled";
    public static final String ORDER_REJECTED = "order.rejected";
    public static final String ORDER_STATUS_UPDATED = "order.status.updated";
    public static final String PAYMENT_INITIATED = "payment.initiated";
    public static final String PAYMENT_SUCCESS = "payment.success";
    public static final String PAYMENT_FAILED = "payment.failed";
    public static final String REFUND_INITIATED = "refund.initiated";
    public static final String REFUND_COMPLETED = "refund.completed";
    public static final String DELIVERY_ASSIGNED = "delivery.assigned";
    public static final String DELIVERY_ACCEPTED = "delivery.accepted";
    public static final String DELIVERY_PICKED_UP = "delivery.picked-up";
    public static final String DELIVERY_COMPLETED = "delivery.completed";
    public static final String NOTIFICATION_REQUESTED = "notification.requested";
    public static final String REVIEW_CREATED = "review.created";
    public static final String COUPON_REDEEMED = "coupon.redeemed";
    /** Technical topics used by the monitoring feature. */
    public static final String AUDIT_PROCESSING = "audit.event-processing";
    public static final String AUDIT_TOPOLOGY = "audit.topology";

    /** Business topics -> human description (used for topic creation and the monitoring UI). */
    public static final Map<String, String> BUSINESS = new java.util.LinkedHashMap<>();
    static {
        BUSINESS.put(USER_REGISTERED, "A new user account was registered");
        BUSINESS.put(RESTAURANT_REGISTERED, "A restaurant was submitted for approval");
        BUSINESS.put(RESTAURANT_APPROVED, "An admin approved a restaurant");
        BUSINESS.put(MENU_ITEM_CREATED, "A food item was added to a menu");
        BUSINESS.put(MENU_ITEM_UPDATED, "A food item was changed, deactivated or re-priced");
        BUSINESS.put(INVENTORY_UPDATED, "Stock of an ingredient changed");
        BUSINESS.put(INVENTORY_LOW_STOCK, "An ingredient fell to or below its alert threshold");
        BUSINESS.put(INVENTORY_RESERVATION_FAILED, "Saga compensation trigger: confirmed order cannot be fulfilled (stock shortage)");
        BUSINESS.put(ORDER_CREATED, "Order placed and awaiting payment");
        BUSINESS.put(ORDER_CONFIRMED, "Payment succeeded; order confirmed and sent to the restaurant");
        BUSINESS.put(ORDER_CANCELLED, "Order cancelled by customer/admin/system");
        BUSINESS.put(ORDER_REJECTED, "Order rejected by the restaurant (or by inventory shortage)");
        BUSINESS.put(ORDER_STATUS_UPDATED, "Any order status transition (authoritative state change feed)");
        BUSINESS.put(PAYMENT_INITIATED, "A payment record was created for an order");
        BUSINESS.put(PAYMENT_SUCCESS, "A payment was verified successfully");
        BUSINESS.put(PAYMENT_FAILED, "A payment failed, was cancelled or timed out");
        BUSINESS.put(REFUND_INITIATED, "A refund was started for a paid order");
        BUSINESS.put(REFUND_COMPLETED, "A refund finished (COMPLETED or FAILED)");
        BUSINESS.put(DELIVERY_ASSIGNED, "A delivery partner was offered a delivery");
        BUSINESS.put(DELIVERY_ACCEPTED, "The delivery partner accepted the delivery");
        BUSINESS.put(DELIVERY_PICKED_UP, "The delivery partner collected the food");
        BUSINESS.put(DELIVERY_COMPLETED, "The food was delivered to the customer");
        BUSINESS.put(NOTIFICATION_REQUESTED, "Explicit request to notify a user (also used by the admin test-publish)");
        BUSINESS.put(REVIEW_CREATED, "A customer submitted a review");
        BUSINESS.put(COUPON_REDEEMED, "A coupon was redeemed by a confirmed order");
    }

    public static List<String> allBusinessTopics() { return List.copyOf(BUSINESS.keySet()); }

    private Topics() {}
}
