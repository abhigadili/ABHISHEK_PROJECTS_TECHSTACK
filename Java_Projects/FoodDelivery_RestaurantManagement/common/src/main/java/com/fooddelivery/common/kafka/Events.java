package com.fooddelivery.common.kafka;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Payload contracts (the {@code payload} field of {@link EventEnvelope}), one record per business event.
 * They are plain immutable records, never Hibernate entities.
 */
public final class Events {
    private Events() {}

    public record UserRegistered(long userId, String username, String email, String phone, String fullName, String role) {}
    public record RestaurantRegistered(long restaurantId, long ownerUserId, String name, String city, String cuisines) {}
    public record RestaurantApproved(long restaurantId, long ownerUserId, String name, String city, String cuisines, String address,
                                     Double latitude, Double longitude, boolean open) {}
    public record MenuItemEvent(long menuItemId, long restaurantId, String name, String description, String category,
                                BigDecimal price, boolean vegetarian, boolean available, String imageUrl) {}
    public record InventoryUpdated(long ingredientId, long restaurantId, String ingredient, BigDecimal quantity, String unit, String reason) {}
    public record LowStock(long ingredientId, long restaurantId, long ownerUserId, String ingredient, BigDecimal quantity, BigDecimal threshold, String unit) {}
    public record ReservationFailed(long orderId, long restaurantId, String reason) {}

    public record OrderLine(long menuItemId, String name, int quantity, BigDecimal unitPrice, String variant) {}
    public record OrderCreated(long orderId, String orderNumber, long customerId, long restaurantId, long restaurantOwnerUserId,
                               BigDecimal totalAmount, String couponCode, List<OrderLine> items) {}
    public record OrderConfirmed(long orderId, String orderNumber, long customerId, long restaurantId, long restaurantOwnerUserId,
                                 BigDecimal totalAmount, BigDecimal discountAmount, String couponCode, List<OrderLine> items,
                                 String deliveryAddress, String deliveryCity) {}
    public record OrderCancelled(long orderId, String orderNumber, long customerId, long restaurantId, String reason,
                                 String cancelledBy, boolean refundRequired, BigDecimal refundAmount, List<OrderLine> items) {}
    public record OrderRejected(long orderId, String orderNumber, long customerId, long restaurantId, String reason,
                                boolean refundRequired, BigDecimal refundAmount, List<OrderLine> items) {}
    public record OrderStatusUpdated(long orderId, String orderNumber, long customerId, long restaurantId, long restaurantOwnerUserId,
                                     String previousStatus, String newStatus, String reason, BigDecimal totalAmount,
                                     String pickupAddress, String deliveryAddress, String deliveryCity, String customerName) {}

    public record PaymentInitiated(long paymentId, long orderId, long customerId, BigDecimal amount, String method, String provider) {}
    public record PaymentSuccess(long paymentId, long orderId, long customerId, BigDecimal amount, String transactionRef, String provider) {}
    public record PaymentFailed(long paymentId, long orderId, long customerId, BigDecimal amount, String reason) {}
    public record RefundInitiated(long refundId, long paymentId, long orderId, long customerId, BigDecimal amount, String reason) {}
    public record RefundCompleted(long refundId, long paymentId, long orderId, long customerId, BigDecimal amount, String status, String reason) {}

    public record DeliveryAssigned(long deliveryId, long orderId, long partnerUserId, long customerId, String pickupAddress, String deliveryAddress) {}
    public record DeliveryAccepted(long deliveryId, long orderId, long partnerUserId, long customerId) {}
    public record DeliveryPickedUp(long deliveryId, long orderId, long partnerUserId, long customerId) {}
    public record DeliveryCompleted(long deliveryId, long orderId, long partnerUserId, long customerId, long restaurantId, Instant deliveredAt) {}

    public record NotificationRequested(long userId, String title, String message, String type, String channel) {}
    /** Carries the authoritative, freshly recomputed aggregates so consumers can simply store them (idempotent, last write wins per key). */
    public record ReviewCreated(long reviewId, long orderId, long customerId, long restaurantId, Long deliveryPartnerId, int restaurantRating,
                                Integer deliveryRating, double restaurantAvgRating, long restaurantRatingCount,
                                Double partnerAvgRating, Long partnerRatingCount) {}
    public record CouponRedeemed(long redemptionId, String couponCode, long customerId, long orderId, BigDecimal discountAmount) {}
}
