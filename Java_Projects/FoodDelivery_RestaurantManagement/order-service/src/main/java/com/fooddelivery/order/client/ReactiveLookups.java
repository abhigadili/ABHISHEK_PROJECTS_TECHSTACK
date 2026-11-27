package com.fooddelivery.order.client;

import com.fooddelivery.common.http.RemoteClient;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.List;

/**
 * WebClient lookups (non-blocking {@link Mono}s). The placement flow composes them with {@code Mono.zip} so the
 * three remote calls run IN PARALLEL, and blocks exactly once at the service boundary.
 */
@Component
public class ReactiveLookups {
    public record AddressInfo(Long id, Long customerId, String label, String line1, String line2, String city, String state,
                              String postalCode, Double latitude, Double longitude, boolean defaultAddress) {}
    public record CustomerInfo(Long userId, String fullName, String email, String phone, String status) {}
    public record RestaurantInfo(Long id, Long ownerUserId, String name, String status, boolean openNow, String addressLine, String city,
                                 BigDecimal deliveryFee, BigDecimal minOrderAmount, int prepTimeMinutes) {}
    public record MenuLine(Long menuItemId, int quantity, String variant, List<Long> addOnIds) {}
    public record MenuValidateRequest(Long restaurantId, List<MenuLine> lines) {}
    public record PricedLine(Long menuItemId, String name, String variant, List<String> addOns, int quantity, BigDecimal unitPrice,
                             BigDecimal lineTotal, boolean vegetarian, int prepTimeMinutes) {}
    public record MenuValidateResponse(Long restaurantId, List<PricedLine> lines, BigDecimal subtotal, int maxPrepTimeMinutes) {}

    private final RemoteClient remote;

    public ReactiveLookups(RemoteClient remote) { this.remote = remote; }

    public Mono<AddressInfo> address(long customerId, long addressId) {
        return remote.get("customer-service", "/internal/customers/{c}/addresses/{a}", AddressInfo.class, customerId, addressId);
    }

    public Mono<CustomerInfo> customer(long customerId) {
        return remote.get("customer-service", "/internal/customers/{c}", CustomerInfo.class, customerId);
    }

    public Mono<RestaurantInfo> restaurant(long restaurantId) {
        return remote.get("restaurant-service", "/internal/restaurants/{r}", RestaurantInfo.class, restaurantId);
    }

    public Mono<MenuValidateResponse> priceMenu(MenuValidateRequest r) {
        return remote.post("menu-service", "/internal/menu/validate", r, MenuValidateResponse.class);
    }
}
