package com.fooddelivery.inventory.web;

import com.fooddelivery.inventory.domain.Ingredient;
import com.fooddelivery.inventory.domain.StockMovement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class Dtos {
    private Dtos() {}

    public record IngredientRequest(@NotBlank @Size(max = 80) String name, @NotBlank @Size(max = 16) String unit,
                                    @NotNull @DecimalMin("0") BigDecimal quantity, @NotNull @DecimalMin("0") BigDecimal lowStockThreshold) {}
    public record RestockRequest(@NotNull @DecimalMin("0.001") BigDecimal quantity, @Size(max = 200) String reason) {}
    public record AdjustRequest(@NotNull @DecimalMin("0") BigDecimal newQuantity, @NotBlank @Size(max = 200) String reason) {}
    public record RecipeLine(@NotNull Long ingredientId, @NotNull @DecimalMin("0.001") BigDecimal quantityPerPortion) {}
    public record RecipeRequest(@NotNull @Valid List<RecipeLine> lines) {}

    public record IngredientDto(Long id, Long restaurantId, String name, String unit, BigDecimal quantity, BigDecimal lowStockThreshold,
                                boolean lowStock, Long version) {
        public static IngredientDto from(Ingredient i) {
            return new IngredientDto(i.getId(), i.getRestaurantId(), i.getName(), i.getUnit(), i.getQuantity(), i.getLowStockThreshold(), i.isLow(), i.getVersion());
        }
    }
    public record MovementDto(Long id, String type, BigDecimal delta, BigDecimal balanceAfter, String reason, Long orderId, String actor, Instant createdAt) {
        public static MovementDto from(StockMovement m) {
            return new MovementDto(m.getId(), m.getType().name(), m.getDelta(), m.getBalanceAfter(), m.getReason(), m.getOrderId(), m.getActor(), m.getCreatedAt());
        }
    }
    public record RecipeDto(Long menuItemId, List<RecipeLineDto> lines) {}
    public record RecipeLineDto(Long ingredientId, String ingredient, String unit, BigDecimal quantityPerPortion) {}

    public record CheckLine(@NotNull Long menuItemId, @Min(1) int quantity) {}
    public record CheckRequest(@NotNull Long restaurantId, @NotEmpty @Valid List<CheckLine> lines) {}
    public record Shortage(Long menuItemId, String ingredient, BigDecimal needed, BigDecimal available) {}
    public record CheckResponse(boolean available, List<Shortage> shortages) {}
    public record Availability(Long menuItemId, long portionsAvailable) {}
    public record Overview(long ingredients, long lowStock, List<IngredientDto> lowStockItems) {}
}
