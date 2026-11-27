package com.fooddelivery.delivery.web;

import com.fooddelivery.delivery.domain.AssignmentLog;
import com.fooddelivery.delivery.domain.Delivery;
import com.fooddelivery.delivery.domain.DeliveryPartner;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class Dtos {
    private Dtos() {}

    public record ProfileRequest(@NotBlank @Size(max = 120) String fullName, @Pattern(regexp = "^[0-9+\\- ]{7,20}$", message = "invalid phone number") String phone,
                                 @Size(max = 20) String vehicleType, @Size(max = 20) String vehicleNumber) {}
    public record OnlineRequest(boolean online) {}
    public record LocationRequest(@NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude, @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
    public record ReasonRequest(@Size(max = 200) String reason) {}
    public record ReassignRequest(Long partnerUserId) {}

    public record PartnerDto(Long userId, String fullName, String phone, String vehicleType, String vehicleNumber, boolean online, boolean busy,
                             boolean suspended, BigDecimal ratingAvg, long ratingCount, int completedDeliveries, int rejectedOffers, String availability) {
        public static PartnerDto from(DeliveryPartner p) {
            String a = p.isSuspended() ? "SUSPENDED" : !p.isOnline() ? "OFFLINE" : p.isBusy() ? "BUSY" : "AVAILABLE";
            return new PartnerDto(p.getUserId(), p.getFullName(), p.getPhone(), p.getVehicleType(), p.getVehicleNumber(), p.isOnline(), p.isBusy(), p.isSuspended(),
                    p.getRatingAvg(), p.getRatingCount(), p.getCompletedDeliveries(), p.getRejectedOffers(), a);
        }
    }

    public record DeliveryDto(Long id, Long orderId, String orderNumber, String status, Long partnerUserId, String customerName, String pickupAddress,
                              String deliveryAddress, String deliveryCity, Instant assignedAt, Instant acceptedAt, Instant pickedUpAt, Instant deliveredAt,
                              Instant offerExpiresAt, int offerCount) {
        public static DeliveryDto from(Delivery d) {
            return new DeliveryDto(d.getId(), d.getOrderId(), d.getOrderNumber(), d.getStatus().name(), d.getPartnerUserId(), d.getCustomerName(), d.getPickupAddress(),
                    d.getDeliveryAddress(), d.getDeliveryCity(), d.getAssignedAt(), d.getAcceptedAt(), d.getPickedUpAt(), d.getDeliveredAt(),
                    d.getStatus() == Delivery.Status.ASSIGNED ? d.getAssignmentExpiresAt() : null, d.getOfferCount());
        }
    }

    public record LogDto(Long partnerUserId, String action, String note, Instant at) {
        public static LogDto from(AssignmentLog l) { return new LogDto(l.getPartnerUserId(), l.getAction(), l.getNote(), l.getAt()); }
    }

    public record Performance(int completed, int rejectedOffers, BigDecimal rating, long ratingCount, Double avgDeliveryMinutes, boolean online) {}
    public record Overview(long partners, long online, long busy, java.util.Map<String, Long> deliveriesByStatus) {}
}
