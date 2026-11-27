package com.fooddelivery.order.web;

import com.fooddelivery.order.domain.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class Dtos {
    private Dtos() {}

    public record PlaceOrderRequest(@NotNull Long addressId, @Size(max = 40) String couponCode,
                                    @NotBlank @Pattern(regexp = "CARD|UPI|WALLET", message = "CARD, UPI or WALLET") String paymentMethod,
                                    @Size(max = 500) String specialInstructions) {}
    public record ReasonRequest(@Size(max = 300) String reason) {}

    public record ItemDto(Long menuItemId, String name, String variant, String addOns, int quantity, BigDecimal unitPrice, BigDecimal lineTotal, String instructions) {
        static ItemDto from(OrderItem i) { return new ItemDto(i.getMenuItemId(), i.getName(), i.getVariant(), i.getAddOns(), i.getQuantity(), i.getUnitPrice(), i.getLineTotal(), i.getInstructions()); }
    }
    public record HistoryDto(String from, String to, String reason, String actor, Instant at) {
        static HistoryDto from(OrderStatusHistory h) { return new HistoryDto(h.getFromStatus() == null ? null : h.getFromStatus().name(), h.getToStatus().name(), h.getReason(), h.getActor(), h.getChangedAt()); }
    }

    public record OrderDto(Long id, String orderNumber, String status, Long customerId, String customerName, Long restaurantId, String restaurantName,
                           String pickupAddress, String deliveryAddress, String deliveryCity, BigDecimal subtotal, BigDecimal discountAmount,
                           String couponCode, BigDecimal deliveryFee, BigDecimal taxAmount, BigDecimal totalAmount, String paymentMethod,
                           String specialInstructions, String cancelReason, int estimatedPrepMinutes, Instant createdAt, List<ItemDto> items,
                           List<HistoryDto> history, List<String> allowedActions) {
        public static OrderDto from(CustomerOrder o, List<String> actions) {
            return new OrderDto(o.getId(), o.getOrderNumber(), o.getStatus().name(), o.getCustomerId(), o.getCustomerName(), o.getRestaurantId(),
                    o.getRestaurantName(), o.getPickupAddress(), o.getDeliveryAddress().oneLine(), o.getDeliveryAddress().getCity(), o.getSubtotal(),
                    o.getDiscountAmount(), o.getCouponCode(), o.getDeliveryFee(), o.getTaxAmount(), o.getTotalAmount(), o.getPaymentMethod(),
                    o.getSpecialInstructions(), o.getCancelReason(), o.getEstimatedPrepMinutes(), o.getCreatedAt(),
                    o.getItems().stream().map(ItemDto::from).toList(), o.getHistory().stream().map(HistoryDto::from).toList(), actions);
        }
    }

    public record SummaryDto(Long id, String orderNumber, String status, BigDecimal totalAmount, Instant createdAt, Long restaurantId,
                             String restaurantName, Long customerId, String customerName, int itemCount) {
        public static SummaryDto from(CustomerOrder o) {
            return new SummaryDto(o.getId(), o.getOrderNumber(), o.getStatus().name(), o.getTotalAmount(), o.getCreatedAt(), o.getRestaurantId(),
                    o.getRestaurantName(), o.getCustomerId(), o.getCustomerName(), o.getItems().size());
        }
    }

    /** Minimal order data other services need (payment: amount; delivery: addresses). */
    public record OrderInfo(Long id, String orderNumber, String status, Long customerId, String customerName, Long restaurantId, String restaurantName,
                            Long restaurantOwnerUserId, BigDecimal totalAmount, String pickupAddress, String deliveryAddress, String deliveryCity,
                            Double deliveryLat, Double deliveryLng, String paymentMethod) {
        public static OrderInfo from(CustomerOrder o) {
            var a = o.getDeliveryAddress();
            return new OrderInfo(o.getId(), o.getOrderNumber(), o.getStatus().name(), o.getCustomerId(), o.getCustomerName(), o.getRestaurantId(),
                    o.getRestaurantName(), o.getRestaurantOwnerUserId(), o.getTotalAmount(), o.getPickupAddress(), a.oneLine(), a.getCity(),
                    a.getLatitude(), a.getLongitude(), o.getPaymentMethod());
        }
    }

    public record Stats(java.util.Map<String, Long> byStatus, long todayPaidOrders, BigDecimal todayRevenue, long total) {}
}
