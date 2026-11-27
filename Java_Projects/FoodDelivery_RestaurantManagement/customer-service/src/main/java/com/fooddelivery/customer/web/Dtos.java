package com.fooddelivery.customer.web;

import com.fooddelivery.customer.domain.Address;
import com.fooddelivery.customer.domain.Customer;
import com.fooddelivery.customer.domain.CustomerActivity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;

public final class Dtos {
    private Dtos() {}

    public record PreferencesDto(String favouriteCuisines, boolean vegetarianOnly, boolean notifyEmail, boolean notifySms, boolean notifyInApp) {}

    public record CustomerDto(Long userId, String fullName, String email, String phone, String avatarUrl, Customer.Status status,
                              PreferencesDto preferences, Instant lastActiveAt) {
        public static CustomerDto from(Customer c) {
            var p = c.getPreferences();
            return new CustomerDto(c.getUserId(), c.getFullName(), c.getEmail(), c.getPhone(), c.getAvatarUrl(), c.getStatus(),
                    new PreferencesDto(p.getFavouriteCuisines(), p.isVegetarianOnly(), p.isNotifyEmail(), p.isNotifySms(), p.isNotifyInApp()),
                    c.getLastActiveAt());
        }
    }

    public record UpdateCustomerRequest(@NotBlank @Size(max = 120) String fullName,
                                        @Pattern(regexp = "^[0-9+\\- ]{7,20}$", message = "invalid phone number") String phone,
                                        @Valid PreferencesDto preferences) {}

    public record AddressRequest(@NotBlank @Size(max = 40) String label, @NotBlank @Size(max = 200) String line1,
                                 @Size(max = 200) String line2, @NotBlank @Size(max = 80) String city, @Size(max = 80) String state,
                                 @NotBlank @Size(max = 12) String postalCode, @DecimalMin("-90") @DecimalMax("90") Double latitude,
                                 @DecimalMin("-180") @DecimalMax("180") Double longitude, boolean makeDefault) {}

    public record AddressDto(Long id, Long customerId, String label, String line1, String line2, String city, String state,
                             String postalCode, Double latitude, Double longitude, boolean defaultAddress) {
        public static AddressDto from(Address a) {
            return new AddressDto(a.getId(), a.getCustomer().getUserId(), a.getLabel(), a.getLine1(), a.getLine2(), a.getCity(),
                    a.getState(), a.getPostalCode(), a.getLatitude(), a.getLongitude(), a.isDefaultAddress());
        }
    }

    public record StatusRequest(@NotNull Customer.Status status) {}
    public record ActivityDto(Long id, String type, String detail, Instant createdAt) {
        public static ActivityDto from(CustomerActivity a) { return new ActivityDto(a.getId(), a.getType(), a.getDetail(), a.getCreatedAt()); }
    }
    public record OrderSummary(Long id, String orderNumber, String status, BigDecimal totalAmount, Instant createdAt,
                               Long restaurantId, String restaurantName) {}
    public record OrderHistory(java.util.List<OrderSummary> orders, boolean degraded) {}
}
