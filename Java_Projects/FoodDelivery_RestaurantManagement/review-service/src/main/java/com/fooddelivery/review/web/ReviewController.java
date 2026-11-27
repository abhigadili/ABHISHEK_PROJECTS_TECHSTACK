package com.fooddelivery.review.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.review.domain.Review;
import com.fooddelivery.review.service.ReviewService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@Tag(name = "Reviews & Ratings")
public class ReviewController {
    private final ReviewService service;

    public ReviewController(ReviewService service) { this.service = service; }

    // ---- public
    @GetMapping("/restaurant/{restaurantId}")
    public PageResponse<Dtos.ReviewDto> forRestaurant(@PathVariable Long restaurantId, @RequestParam(required = false) String sort,
                                                      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return PageResponse.of(service.forRestaurant(restaurantId, sort, page, size), r -> r);
    }

    @GetMapping("/summary/restaurant/{restaurantId}")
    public Dtos.Summary restaurantSummary(@PathVariable Long restaurantId) { return service.restaurantSummary(restaurantId); }

    @GetMapping("/summary/item/{itemId}")
    public Dtos.Summary itemSummary(@PathVariable Long itemId) { return service.itemSummary(itemId); }

    // ---- customer
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.ReviewDto create(@Valid @RequestBody Dtos.ReviewRequest r) { return service.create(r); }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.ReviewDto update(@PathVariable Long id, @Valid @RequestBody Dtos.UpdateRequest r) { return service.update(id, r); }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN','SUPER_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    public PageResponse<Dtos.ReviewDto> mine(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return PageResponse.of(service.mine(page, size), r -> r);
    }

    @GetMapping("/reviewable")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<Dtos.EligibleDto> reviewable() { return service.reviewable(); }

    @GetMapping("/partner/{partnerId}/summary")
    @PreAuthorize("hasAnyRole('DELIVERY_PARTNER','ADMIN','SUPER_ADMIN','SERVICE')")
    public Dtos.Summary partner(@PathVariable Long partnerId) { return service.partnerSummary(partnerId); }

    // ---- admin moderation
    @GetMapping("/admin")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PageResponse<Dtos.ReviewDto> adminList(@RequestParam(required = false) Review.Status status, @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.adminList(status, page, size), r -> r);
    }

    @PostMapping("/{id}/hide")
    @PreAuthorize("hasAuthority('PERM_REVIEW_MODERATE')")
    public Dtos.ReviewDto hide(@PathVariable Long id, @RequestBody(required = false) Dtos.ModerationRequest r) { return service.moderate(id, true, r == null ? null : r.note()); }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasAuthority('PERM_REVIEW_MODERATE')")
    public Dtos.ReviewDto restore(@PathVariable Long id) { return service.moderate(id, false, null); }
}
