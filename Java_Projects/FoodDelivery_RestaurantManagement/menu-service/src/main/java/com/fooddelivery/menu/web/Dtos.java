package com.fooddelivery.menu.web;

import com.fooddelivery.menu.domain.AddOn;
import com.fooddelivery.menu.domain.ItemVariant;
import com.fooddelivery.menu.domain.MenuCategory;
import com.fooddelivery.menu.domain.MenuItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public final class Dtos {
    private Dtos() {}

    public static <T, R> ArrayList<R> map(java.util.Collection<T> src, java.util.function.Function<T, R> f) {
        return src.stream().map(f).collect(Collectors.toCollection(ArrayList::new));
    }

    // ---- requests
    public record CategoryRequest(@NotBlank @Size(max = 60) String name, @Size(max = 200) String description, @Min(0) @Max(999) Integer displayOrder) {}
    public record VariantRequest(@NotBlank @Size(max = 40) String name, @NotNull @DecimalMin("0.00") BigDecimal extraPrice) {}
    public record AddOnRequest(@NotBlank @Size(max = 60) String name, @NotNull @DecimalMin("0.00") BigDecimal price, Boolean available) {}
    public record ItemRequest(@NotNull Long categoryId, @NotBlank @Size(max = 120) String name, @Size(max = 600) String description,
                              @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal basePrice, boolean vegetarian,
                              @Min(1) @Max(240) Integer prepTimeMinutes, @Size(max = 200) String tags,
                              @Valid List<VariantRequest> variants, @Valid List<AddOnRequest> addOns) {}
    public record AvailabilityRequest(boolean available) {}

    // ---- responses (Serializable records are cached in Redis)
    public record VariantDto(Long id, String name, BigDecimal extraPrice) implements Serializable {
        public static VariantDto from(ItemVariant v) { return new VariantDto(v.getId(), v.getName(), v.getExtraPrice()); }
    }
    public record AddOnDto(Long id, String name, BigDecimal price, boolean available) implements Serializable {
        public static AddOnDto from(AddOn a) { return new AddOnDto(a.getId(), a.getName(), a.getPrice(), a.isAvailable()); }
    }
    public record ItemDto(Long id, Long restaurantId, Long categoryId, String category, String name, String description, BigDecimal basePrice,
                          boolean vegetarian, boolean available, String imageUrl, int prepTimeMinutes, String tags,
                          ArrayList<VariantDto> variants, ArrayList<AddOnDto> addOns) implements Serializable {
        public static ItemDto from(MenuItem i) {
            return new ItemDto(i.getId(), i.getRestaurantId(), i.getCategory().getId(), i.getCategory().getName(), i.getName(), i.getDescription(),
                    i.getBasePrice(), i.isVegetarian(), i.isAvailable() && i.isActive(), i.getImageUrl(), i.getPrepTimeMinutes(), i.getTags(),
                    map(i.getVariants(), VariantDto::from), map(i.getAddOns(), AddOnDto::from));
        }
    }
    public record CategoryDto(Long id, String name, String description, int displayOrder, ArrayList<ItemDto> items) implements Serializable {
        public static CategoryDto from(MenuCategory c, ArrayList<ItemDto> items) { return new CategoryDto(c.getId(), c.getName(), c.getDescription(), c.getDisplayOrder(), items); }
    }
    public record MenuDto(Long restaurantId, ArrayList<CategoryDto> categories, int totalItems) implements Serializable {}

    // ---- internal validation contract (used by cart-service and order-service)
    public record LineRequest(@NotNull Long menuItemId, @Min(1) @Max(50) int quantity, String variant, List<Long> addOnIds) {}
    public record ValidateRequest(@NotNull Long restaurantId, @NotEmpty @Valid List<LineRequest> lines) {}
    public record PricedLine(Long menuItemId, String name, String variant, List<String> addOns, int quantity, BigDecimal unitPrice,
                             BigDecimal lineTotal, boolean vegetarian, int prepTimeMinutes) {}
    public record ValidateResponse(Long restaurantId, List<PricedLine> lines, BigDecimal subtotal, int maxPrepTimeMinutes) {}
    public record ItemInfo(Long id, Long restaurantId, String name, BigDecimal basePrice, boolean available, boolean active) {}
}
