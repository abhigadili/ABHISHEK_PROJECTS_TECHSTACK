package com.fooddelivery.cart.client;

import com.fooddelivery.common.http.RemoteClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;

/** WebClient-based call to menu-service (authoritative pricing/availability). Blocks once, at the service boundary. */
@Component
public class MenuPricingClient {
    public record Line(Long menuItemId, int quantity, String variant, List<Long> addOnIds) {}
    public record ValidateRequest(Long restaurantId, List<Line> lines) {}
    public record Priced(Long menuItemId, String name, String variant, List<String> addOns, int quantity, BigDecimal unitPrice,
                         BigDecimal lineTotal, boolean vegetarian, int prepTimeMinutes) {}
    public record ValidateResponse(Long restaurantId, List<Priced> lines, BigDecimal subtotal, int maxPrepTimeMinutes) {}

    private final RemoteClient remote;

    public MenuPricingClient(RemoteClient remote) { this.remote = remote; }

    public ValidateResponse validate(Long restaurantId, List<Line> lines) {
        return remote.post("menu-service", "/internal/menu/validate", new ValidateRequest(restaurantId, lines), ValidateResponse.class)
                .block(Duration.ofSeconds(8));
    }
}
