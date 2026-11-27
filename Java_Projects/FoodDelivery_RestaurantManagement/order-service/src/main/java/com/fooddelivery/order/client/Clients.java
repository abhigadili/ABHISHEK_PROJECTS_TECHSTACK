package com.fooddelivery.order.client;

import com.fooddelivery.common.web.PageResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.math.BigDecimal;
import java.util.List;

/** Feign clients used by the order service (declarative). The WebClient-based calls live in {@link ReactiveLookups}. */
public final class Clients {
    private Clients() {}

    public record SelectionLine(Long menuItemId, int quantity, String variant, List<Long> addOnIds, String instructions) {}
    public record Selection(Long restaurantId, String couponCode, List<SelectionLine> lines) {}

    @FeignClient(name = "cart-service", contextId = "cartClient")
    public interface CartClient {
        @GetMapping("/api/cart/selection")
        Selection selection();
    }

    public record CouponCheckRequest(String code, Long customerId, Long restaurantId, BigDecimal subtotal) {}
    public record CouponCheckResponse(boolean valid, String code, BigDecimal discountAmount, String message) {}

    @FeignClient(name = "coupon-service", contextId = "couponClient")
    public interface CouponClient {
        @PostMapping("/internal/coupons/validate")
        CouponCheckResponse validate(@RequestBody CouponCheckRequest r);
    }

    public record InvCheckLine(Long menuItemId, int quantity) {}
    public record InvCheckRequest(Long restaurantId, List<InvCheckLine> lines) {}
    public record Shortage(Long menuItemId, String ingredient, BigDecimal needed, BigDecimal available) {}
    public record InvCheckResponse(boolean available, List<Shortage> shortages) {}

    @FeignClient(name = "inventory-service", contextId = "inventoryClient")
    public interface InventoryClient {
        @PostMapping("/internal/inventory/check")
        InvCheckResponse check(@RequestBody InvCheckRequest r);
    }
}
