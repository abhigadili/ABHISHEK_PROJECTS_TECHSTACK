package com.fooddelivery.review.web;

import com.fooddelivery.review.domain.ItemRating;
import com.fooddelivery.review.domain.Review;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class Dtos {
    private Dtos() {}

    public record ItemRatingRequest(@NotNull Long menuItemId, @Min(1) @Max(5) int rating) {}
    public record ReviewRequest(@NotNull Long orderId, @Min(1) @Max(5) int restaurantRating, @Min(1) @Max(5) Integer deliveryRating,
                                @Size(max = 1000) String comment, @Valid List<ItemRatingRequest> itemRatings) {}
    public record UpdateRequest(@Min(1) @Max(5) int restaurantRating, @Min(1) @Max(5) Integer deliveryRating, @Size(max = 1000) String comment) {}
    public record ModerationRequest(@Size(max = 300) String note) {}

    public record ItemRatingDto(Long menuItemId, String itemName, int rating) {
        static ItemRatingDto from(ItemRating i) { return new ItemRatingDto(i.getMenuItemId(), i.getItemName(), i.getRating()); }
    }
    public record ReviewDto(Long id, Long orderId, String reviewerName, Long restaurantId, Long deliveryPartnerId, int restaurantRating, Integer deliveryRating,
                            String comment, String status, String moderationNote, Instant createdAt, List<ItemRatingDto> itemRatings) {
        public static ReviewDto from(Review r) {
            return new ReviewDto(r.getId(), r.getOrderId(), r.getReviewerName(), r.getRestaurantId(), r.getDeliveryPartnerId(), r.getRestaurantRating(), r.getDeliveryRating(),
                    r.getComment(), r.getStatus().name(), r.getModerationNote(), r.getCreatedAt(), r.getItemRatings().stream().map(ItemRatingDto::from).toList());
        }
    }
    public record Summary(Long subjectId, double average, long count, Map<Integer, Long> distribution) implements Serializable {}
    public record EligibleDto(Long orderId, Long restaurantId, Instant deliveredAt, Long deliveryPartnerId) {}
}
