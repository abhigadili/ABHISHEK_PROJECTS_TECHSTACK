package com.fooddelivery.review.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.review.domain.*;
import com.fooddelivery.review.event.ReviewEventProducer;
import com.fooddelivery.review.repository.*;
import com.fooddelivery.review.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Review rules: only the customer of a DELIVERED order may review it (eligibility comes from delivery.completed),
 * once per order, within the review window, rating only dishes that were in the order. Every change recomputes the
 * rating aggregates and publishes them so restaurant-service / delivery-service can keep their copies up to date.
 */
@Service
public class ReviewService {
    private static final Logger log = LoggerFactory.getLogger(ReviewService.class);
    private final ReviewRepository reviews;
    private final EligibleOrderRepository eligible;
    private final OrderLineRecordRepository lines;
    private final ReviewEventProducer events;
    private final Duration window;

    public ReviewService(ReviewRepository reviews, EligibleOrderRepository eligible, OrderLineRecordRepository lines, ReviewEventProducer events,
                         @Value("${food.review.window-days:7}") long windowDays) {
        this.reviews = reviews;
        this.eligible = eligible;
        this.lines = lines;
        this.events = events;
        this.window = Duration.ofDays(windowDays);
    }

    // ------------------------------------------------------------ Kafka-driven eligibility
    @Transactional
    public void onOrderConfirmed(Events.OrderConfirmed e) {
        if (lines.existsByOrderId(e.orderId())) return;
        for (var l : e.items()) {
            OrderLineRecord r = new OrderLineRecord();
            r.setOrderId(e.orderId());
            r.setMenuItemId(l.menuItemId());
            r.setName(l.name());
            lines.save(r);
        }
    }

    @Transactional
    public void onDeliveryCompleted(Events.DeliveryCompleted e) {
        if (eligible.existsById(e.orderId())) return;
        EligibleOrder o = new EligibleOrder();
        o.setOrderId(e.orderId());
        o.setCustomerId(e.customerId());
        o.setRestaurantId(e.restaurantId());
        o.setDeliveryPartnerId(e.partnerUserId());
        o.setDeliveredAt(e.deliveredAt() == null ? Instant.now() : e.deliveredAt());
        eligible.save(o);
    }

    // ------------------------------------------------------------ customer
    @Audited("REVIEW_CREATE")
    @Transactional
    @Caching(evict = @CacheEvict(cacheNames = "review-summary", allEntries = true))
    public Dtos.ReviewDto create(Dtos.ReviewRequest r) {
        AuthUser u = SecurityUtils.requireUser();
        EligibleOrder el = eligible.findById(r.orderId()).orElseThrow(() -> new BadRequestException("NOT_ELIGIBLE", "Only delivered orders can be reviewed"));
        if (el.getCustomerId() != u.userId()) throw new ForbiddenException("You can only review your own orders");
        if (el.isReviewed() || reviews.findByOrderId(r.orderId()).isPresent()) throw new ConflictException("This order has already been reviewed");
        if (Instant.now().isAfter(el.getDeliveredAt().plus(window))) throw new BadRequestException("REVIEW_WINDOW_CLOSED", "The review window for this order has closed");
        if (r.deliveryRating() != null && el.getDeliveryPartnerId() == null) throw new BadRequestException("This order has no delivery partner to rate");
        Review rev = new Review();
        rev.setOrderId(r.orderId());
        rev.setCustomerId(u.userId());
        rev.setReviewerName(mask(u.username()));
        rev.setRestaurantId(el.getRestaurantId());
        rev.setDeliveryPartnerId(r.deliveryRating() == null ? null : el.getDeliveryPartnerId());
        rev.setRestaurantRating(r.restaurantRating());
        rev.setDeliveryRating(r.deliveryRating());
        rev.setComment(r.comment());
        if (r.itemRatings() != null) {
            Map<Long, String> inOrder = lines.findByOrderId(r.orderId()).stream().collect(Collectors.toMap(OrderLineRecord::getMenuItemId, OrderLineRecord::getName, (a, b) -> a));
            Set<Long> seen = new HashSet<>();
            for (var ir : r.itemRatings()) {
                if (!inOrder.containsKey(ir.menuItemId())) throw new BadRequestException("ITEM_NOT_IN_ORDER", "Item " + ir.menuItemId() + " was not part of this order");
                if (!seen.add(ir.menuItemId())) throw new BadRequestException("Duplicate item rating");
                ItemRating i = new ItemRating();
                i.setReview(rev);
                i.setMenuItemId(ir.menuItemId());
                i.setItemName(inOrder.get(ir.menuItemId()));
                i.setRating(ir.rating());
                rev.getItemRatings().add(i);
            }
        }
        reviews.saveAndFlush(rev);
        el.setReviewed(true);
        publish("ReviewCreated", rev);
        log.info("Review {} created for order {} restaurantRating={}", rev.getId(), rev.getOrderId(), rev.getRestaurantRating());
        return Dtos.ReviewDto.from(rev);
    }

    @Transactional
    @CacheEvict(cacheNames = "review-summary", allEntries = true)
    public Dtos.ReviewDto update(Long id, Dtos.UpdateRequest r) {
        Review rev = find(id);
        if (rev.getCustomerId() != SecurityUtils.requireUser().userId()) throw new ForbiddenException("Not your review");
        if (Instant.now().isAfter(rev.getCreatedAt().plus(Duration.ofHours(48)))) throw new BadRequestException("EDIT_WINDOW_CLOSED", "Reviews can be edited for 48 hours");
        if (r.deliveryRating() != null && rev.getDeliveryPartnerId() == null) {
            eligible.findById(rev.getOrderId()).ifPresent(el -> rev.setDeliveryPartnerId(el.getDeliveryPartnerId()));
        }
        rev.setRestaurantRating(r.restaurantRating());
        rev.setDeliveryRating(r.deliveryRating());
        rev.setComment(r.comment());
        reviews.flush();
        publish("ReviewUpdated", rev);
        return Dtos.ReviewDto.from(rev);
    }

    @Transactional
    @CacheEvict(cacheNames = "review-summary", allEntries = true)
    public void delete(Long id) {
        Review rev = find(id);
        AuthUser u = SecurityUtils.requireUser();
        if (!u.isAdmin() && rev.getCustomerId() != u.userId()) throw new ForbiddenException("Not your review");
        reviews.delete(rev);
        reviews.flush();
        publish("ReviewRemoved", rev);
    }

    @Transactional(readOnly = true)
    public Page<Dtos.ReviewDto> mine(int page, int size) {
        return reviews.findByCustomerIdOrderByCreatedAtDesc(SecurityUtils.requireUser().userId(), PageRequest.of(page, Math.min(size, 50))).map(Dtos.ReviewDto::from);
    }

    @Transactional(readOnly = true)
    public List<Dtos.EligibleDto> reviewable() {
        return eligible.findByCustomerIdAndReviewedFalseOrderByDeliveredAtDesc(SecurityUtils.requireUser().userId()).stream()
                .filter(o -> Instant.now().isBefore(o.getDeliveredAt().plus(window)))
                .map(o -> new Dtos.EligibleDto(o.getOrderId(), o.getRestaurantId(), o.getDeliveredAt(), o.getDeliveryPartnerId())).toList();
    }

    // ------------------------------------------------------------ public reads
    @Transactional(readOnly = true)
    public Page<Dtos.ReviewDto> forRestaurant(Long restaurantId, String sort, int page, int size) {
        Sort s = "lowest".equals(sort) ? Sort.by("restaurantRating").ascending() : "highest".equals(sort) ? Sort.by("restaurantRating").descending() : Sort.by("createdAt").descending();
        return reviews.findByRestaurantIdAndStatus(restaurantId, Review.Status.VISIBLE, PageRequest.of(page, Math.min(size, 50), s)).map(Dtos.ReviewDto::from);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "review-summary", key = "'restaurant:' + #restaurantId")
    public Dtos.Summary restaurantSummary(Long restaurantId) {
        var agg = reviews.restaurantAggregate(restaurantId).get(0);
        Map<Integer, Long> dist = new TreeMap<>(Comparator.reverseOrder());
        for (int i = 1; i <= 5; i++) dist.put(i, 0L);
        reviews.restaurantDistribution(restaurantId).forEach(row -> dist.put((Integer) row[0], (Long) row[1]));
        return new Dtos.Summary(restaurantId, round(agg[0]), (Long) agg[1], new LinkedHashMap<>(dist));
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "review-summary", key = "'item:' + #itemId")
    public Dtos.Summary itemSummary(Long itemId) {
        var agg = reviews.itemAggregate(itemId).get(0);
        return new Dtos.Summary(itemId, round(agg[0]), (Long) agg[1], new LinkedHashMap<>());
    }

    @Transactional(readOnly = true)
    public Dtos.Summary partnerSummary(Long partnerId) {
        AuthUser u = SecurityUtils.requireUser();
        if (!u.isAdmin() && !u.isService() && u.userId() != partnerId) throw new ForbiddenException("Not your rating");
        var agg = reviews.partnerAggregate(partnerId).get(0);
        return new Dtos.Summary(partnerId, round(agg[0]), (Long) agg[1], new LinkedHashMap<>());
    }

    // ------------------------------------------------------------ moderation
    @Transactional(readOnly = true)
    public Page<Dtos.ReviewDto> adminList(Review.Status status, int page, int size) {
        var pr = PageRequest.of(page, Math.min(size, 100));
        return (status == null ? reviews.findAllByOrderByCreatedAtDesc(pr) : reviews.findByStatusOrderByCreatedAtDesc(status, pr)).map(Dtos.ReviewDto::from);
    }

    @Audited("REVIEW_MODERATE")
    @Transactional
    @CacheEvict(cacheNames = "review-summary", allEntries = true)
    public Dtos.ReviewDto moderate(Long id, boolean hide, String note) {
        Review rev = find(id);
        rev.setStatus(hide ? Review.Status.HIDDEN : Review.Status.VISIBLE);
        rev.setModerationNote(hide ? note : null);
        reviews.flush();
        publish(hide ? "ReviewHidden" : "ReviewRestored", rev);
        return Dtos.ReviewDto.from(rev);
    }

    // ------------------------------------------------------------ helpers
    private void publish(String type, Review rev) {
        var ra = reviews.restaurantAggregate(rev.getRestaurantId()).get(0);
        Double pAvg = null;
        Long pCount = null;
        if (rev.getDeliveryPartnerId() != null) {
            var pa = reviews.partnerAggregate(rev.getDeliveryPartnerId()).get(0);
            pAvg = round(pa[0]);
            pCount = (Long) pa[1];
        }
        events.publish(type, rev, round(ra[0]), (Long) ra[1], pAvg, pCount);
    }

    private static double round(Object avg) {
        return avg == null ? 0.0 : BigDecimal.valueOf(((Number) avg).doubleValue()).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private static String mask(String name) {
        if (name == null || name.length() < 3) return "user";
        return name.charAt(0) + "*".repeat(Math.min(name.length() - 2, 6)) + name.charAt(name.length() - 1);
    }

    private Review find(Long id) { return reviews.findById(id).orElseThrow(() -> new NotFoundException("Review", id)); }
}
