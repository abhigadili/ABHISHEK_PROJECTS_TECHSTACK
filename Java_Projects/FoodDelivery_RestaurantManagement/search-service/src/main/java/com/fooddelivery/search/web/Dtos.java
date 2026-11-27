package com.fooddelivery.search.web;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;

public final class Dtos {
    private Dtos() {}

    public record SearchQuery(String q, String type, String city, Double lat, Double lng, Double radiusKm, Boolean vegetarian, int limit) {}
    public record RestaurantHit(Long id, String name, String city, String cuisines, String address, BigDecimal rating, long ratingCount, Double distanceKm) implements Serializable {}
    public record FoodHit(Long menuItemId, String name, String description, String category, BigDecimal price, boolean vegetarian, String imageUrl,
                          Long restaurantId, String restaurantName) implements Serializable {}
    public record OfferHit(String code, String description, String discountType, BigDecimal discountValue, BigDecimal minOrderValue, Long restaurantId) implements Serializable {}
    public record SearchResponse(String query, String engine, List<RestaurantHit> restaurants, List<FoodHit> foods, List<String> cuisines,
                                 List<String> categories, List<OfferHit> offers) implements Serializable {}
}
