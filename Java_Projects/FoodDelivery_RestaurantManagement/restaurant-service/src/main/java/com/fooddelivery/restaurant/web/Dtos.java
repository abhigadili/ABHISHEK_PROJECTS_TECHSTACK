package com.fooddelivery.restaurant.web;

import com.fooddelivery.restaurant.domain.OpeningHour;
import com.fooddelivery.restaurant.domain.Restaurant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

public final class Dtos {
    private Dtos() {}

    public record HourDto(@NotNull DayOfWeek dayOfWeek, LocalTime opensAt, LocalTime closesAt, boolean closed) {}

    public record RestaurantRequest(@NotBlank @Size(max = 120) String name, @Size(max = 1000) String description,
                                    @Size(max = 40) String category, @NotEmpty Set<@NotBlank @Size(max = 40) String> cuisines,
                                    boolean pureVeg, @Pattern(regexp = "^[0-9+\\- ]{7,20}$", message = "invalid phone number") String phone,
                                    @Email String email, @NotBlank @Size(max = 200) String addressLine, @NotBlank @Size(max = 80) String city,
                                    @Size(max = 80) String state, @Size(max = 12) String postalCode,
                                    @DecimalMin("-90") @DecimalMax("90") Double latitude, @DecimalMin("-180") @DecimalMax("180") Double longitude,
                                    @DecimalMin("0") BigDecimal minOrderAmount, @DecimalMin("0") BigDecimal deliveryFee,
                                    @Min(5) @Max(180) Integer prepTimeMinutes) {}

    public record HoursRequest(@NotEmpty @Valid List<HourDto> hours) {}
    public record AvailabilityRequest(boolean open) {}
    public record ReasonRequest(@Size(max = 300) String reason) {}

    /** Serializable DTO cached in Redis. */
    public record RestaurantDto(Long id, Long ownerUserId, String name, String description, String category, Set<String> cuisines,
                                boolean pureVeg, String status, boolean acceptingOrders, boolean openNow, String phone, String email,
                                String addressLine, String city, String state, String postalCode, Double latitude, Double longitude,
                                String logoUrl, List<String> imageUrls, BigDecimal avgRating, long ratingCount, BigDecimal minOrderAmount,
                                BigDecimal deliveryFee, int prepTimeMinutes, List<HourDto> hours, Double distanceKm, String statusReason) implements Serializable {
        public static RestaurantDto from(Restaurant r, Double distanceKm) {
            return new RestaurantDto(r.getId(), r.getOwnerUserId(), r.getName(), r.getDescription(), r.getCategory(),
                    new java.util.TreeSet<>(r.getCuisines()), r.isPureVeg(), r.getStatus().name(), r.isOpen(), isOpenNow(r), r.getPhone(), r.getEmail(),
                    r.getAddressLine(), r.getCity(), r.getState(), r.getPostalCode(), r.getLatitude(), r.getLongitude(), r.getLogoUrl(),
                    new java.util.ArrayList<>(r.getImageUrls()), r.getAvgRating(), r.getRatingCount(), r.getMinOrderAmount(), r.getDeliveryFee(),
                    r.getPrepTimeMinutes(), r.getHours().stream().map(h -> new HourDto(h.getDayOfWeek(), h.getOpensAt(), h.getClosesAt(), h.isClosed())).collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new)),
                    distanceKm, r.getStatusReason());
        }

        public static boolean isOpenNow(Restaurant r) {
            if (r.getStatus() != Restaurant.Status.APPROVED || !r.isOpen()) return false;
            if (r.getHours().isEmpty()) return true;       // no hours configured = always open
            var now = java.time.LocalDateTime.now();
            return r.getHours().stream().filter(h -> h.getDayOfWeek() == now.getDayOfWeek()).anyMatch(h -> h.coversNow(now.toLocalTime()));
        }
    }

    /** What other services need to know to take an order. */
    public record RestaurantInfo(Long id, Long ownerUserId, String name, String status, boolean openNow, String addressLine, String city,
                                 BigDecimal deliveryFee, BigDecimal minOrderAmount, int prepTimeMinutes) {
        public static RestaurantInfo from(Restaurant r) {
            return new RestaurantInfo(r.getId(), r.getOwnerUserId(), r.getName(), r.getStatus().name(), RestaurantDto.isOpenNow(r),
                    r.getAddressLine(), r.getCity(), r.getDeliveryFee(), r.getMinOrderAmount(), r.getPrepTimeMinutes());
        }
    }

    public record SalesSummary(long totalOrders, long deliveredOrders, long cancelledOrRejected, long inProgress, BigDecimal deliveredRevenue) {}
}
