package com.fooddelivery.coupon.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.coupon.domain.Campaign;
import com.fooddelivery.coupon.domain.Coupon;
import com.fooddelivery.coupon.domain.CouponRedemption;
import com.fooddelivery.coupon.event.CouponEventProducer;
import com.fooddelivery.coupon.repository.CampaignRepository;
import com.fooddelivery.coupon.repository.CouponRedemptionRepository;
import com.fooddelivery.coupon.repository.CouponRepository;
import com.fooddelivery.coupon.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/** Coupon rules live ONLY here: the backend decides validity and the discount amount, never the frontend. */
@Service
public class CouponService {
    private static final Logger log = LoggerFactory.getLogger(CouponService.class);
    private final CouponRepository coupons;
    private final CouponRedemptionRepository redemptions;
    private final CampaignRepository campaigns;
    private final CouponEventProducer events;

    public CouponService(CouponRepository coupons, CouponRedemptionRepository redemptions, CampaignRepository campaigns, CouponEventProducer events) {
        this.coupons = coupons;
        this.redemptions = redemptions;
        this.campaigns = campaigns;
        this.events = events;
    }

    // ---------------------------------------------------------------- validation (used by cart + order)
    @Transactional(readOnly = true)
    public Dtos.CheckResponse validate(Dtos.CheckRequest r) {
        AuthUser caller = SecurityUtils.requireUser();
        if (!caller.isService() && !caller.isAdmin() && caller.userId() != r.customerId()) throw new ForbiddenException("Not your cart");
        Coupon c = lookup(r.code()).orElse(null);
        if (c == null) return reject(r.code(), "Coupon code not found");
        return check(c, r.customerId(), r.restaurantId(), r.subtotal());
    }

    private java.util.Optional<Coupon> lookup(String code) { return coupons.findByCodeIgnoreCase(code.trim()); }

    Dtos.CheckResponse check(Coupon c, Long customerId, Long restaurantId, BigDecimal subtotal) {
        Instant now = Instant.now();
        if (!c.isActive()) return reject(c.getCode(), "This coupon is not active");
        if (now.isBefore(c.getValidFrom())) return reject(c.getCode(), "This coupon is not valid yet");
        if (now.isAfter(c.getValidTo())) return reject(c.getCode(), "This coupon has expired");
        if (c.getRestaurantId() != null && !c.getRestaurantId().equals(restaurantId)) return reject(c.getCode(), "This coupon is not valid for this restaurant");
        if (c.getEligibleUserId() != null && !c.getEligibleUserId().equals(customerId)) return reject(c.getCode(), "This coupon is not available for your account");
        if (subtotal.compareTo(c.getMinOrderValue()) < 0) return reject(c.getCode(), "Minimum order value for this coupon is " + c.getMinOrderValue());
        if (c.getTotalUsageLimit() != null && c.getUsedCount() >= c.getTotalUsageLimit()) return reject(c.getCode(), "This coupon has been fully redeemed");
        if (c.getPerUserLimit() != null && redemptions.countByCouponIdAndCustomerId(c.getId(), customerId) >= c.getPerUserLimit()) {
            return reject(c.getCode(), "You have already used this coupon the maximum number of times");
        }
        BigDecimal discount = c.getDiscountType() == Coupon.DiscountType.PERCENTAGE
                ? subtotal.multiply(c.getDiscountValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : c.getDiscountValue();
        if (c.getMaxDiscount() != null) discount = discount.min(c.getMaxDiscount());
        discount = discount.min(subtotal).setScale(2, RoundingMode.HALF_UP);
        return new Dtos.CheckResponse(true, c.getCode(), discount, "Coupon applied: you save " + discount);
    }

    private Dtos.CheckResponse reject(String code, String msg) { return new Dtos.CheckResponse(false, code, BigDecimal.ZERO, msg); }

    // ---------------------------------------------------------------- redemption (Kafka-driven, idempotent per order)
    @Transactional
    public void redeem(Events.OrderConfirmed e) {
        if (e.couponCode() == null || e.couponCode().isBlank()) return;
        if (redemptions.existsByOrderId(e.orderId())) return;
        Coupon c = lookup(e.couponCode()).orElse(null);
        if (c == null) { log.warn("Order {} used unknown coupon {}", e.orderId(), e.couponCode()); return; }
        CouponRedemption r = new CouponRedemption();
        r.setCoupon(c);
        r.setCustomerId(e.customerId());
        r.setOrderId(e.orderId());
        r.setDiscountAmount(e.discountAmount() == null ? BigDecimal.ZERO : e.discountAmount());
        redemptions.save(r);
        coupons.incrementUsed(c.getId());
        events.redeemed(new Events.CouponRedeemed(r.getId(), c.getCode(), e.customerId(), e.orderId(), r.getDiscountAmount()));
        log.info("Coupon {} redeemed by customer {} for order {}", c.getCode(), e.customerId(), e.orderId());
    }

    // ---------------------------------------------------------------- admin CRUD
    @Audited("COUPON_CREATE")
    @Transactional
    @CacheEvict(cacheNames = "coupon-public", allEntries = true)
    public Dtos.CouponDto create(Dtos.CouponRequest r) {
        if (coupons.existsByCodeIgnoreCase(r.code())) throw new ConflictException("Coupon code already exists");
        Coupon c = new Coupon();
        apply(c, r);
        return Dtos.CouponDto.from(coupons.save(c));
    }

    @Audited("COUPON_UPDATE")
    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "coupon", allEntries = true), @CacheEvict(cacheNames = "coupon-public", allEntries = true)})
    public Dtos.CouponDto update(Long id, Dtos.CouponRequest r) {
        Coupon c = find(id);
        if (!c.getCode().equalsIgnoreCase(r.code()) && coupons.existsByCodeIgnoreCase(r.code())) throw new ConflictException("Coupon code already exists");
        apply(c, r);
        return Dtos.CouponDto.from(c);
    }

    @Audited("COUPON_ACTIVATION")
    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "coupon", allEntries = true), @CacheEvict(cacheNames = "coupon-public", allEntries = true)})
    public Dtos.CouponDto setActive(Long id, boolean active) {
        Coupon c = find(id);
        c.setActive(active);
        return Dtos.CouponDto.from(c);
    }

    @Transactional(readOnly = true)
    public Page<Dtos.CouponDto> list(Pageable p) { return coupons.findAll(p).map(Dtos.CouponDto::from); }

    @Transactional(readOnly = true)
    public Page<Dtos.RedemptionDto> history(Long couponId, Pageable p) {
        find(couponId);
        return redemptions.findByCouponIdOrderByRedeemedAtDesc(couponId, p).map(Dtos.RedemptionDto::from);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "coupon-public", key = "'active:' + (#restaurantId == null ? 'all' : #restaurantId)")
    public ArrayList<Dtos.CouponDto> publicActive(Long restaurantId) {
        return coupons.findPublicActive(Instant.now(), restaurantId).stream().map(Dtos.CouponDto::from).collect(Collectors.toCollection(ArrayList::new));
    }

    // ---------------------------------------------------------------- campaigns
    @Transactional
    @CacheEvict(cacheNames = "coupon-public", allEntries = true)
    public Dtos.CampaignDto createCampaign(Dtos.CampaignRequest r) {
        if (r.endsAt().isBefore(r.startsAt())) throw new BadRequestException("endsAt must be after startsAt");
        Campaign c = new Campaign();
        applyCampaign(c, r);
        return Dtos.CampaignDto.from(campaigns.save(c));
    }

    @Transactional
    @CacheEvict(cacheNames = "coupon-public", allEntries = true)
    public Dtos.CampaignDto updateCampaign(Long id, Dtos.CampaignRequest r) {
        Campaign c = campaigns.findById(id).orElseThrow(() -> new NotFoundException("Campaign", id));
        applyCampaign(c, r);
        return Dtos.CampaignDto.from(c);
    }

    @Transactional(readOnly = true)
    public List<Dtos.CampaignDto> allCampaigns() { return campaigns.findAll().stream().map(Dtos.CampaignDto::from).toList(); }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "coupon-public", key = "'campaigns'")
    public ArrayList<Dtos.CampaignDto> activeCampaigns() {
        Instant now = Instant.now();
        return campaigns.findByActiveTrueAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(now, now).stream().map(Dtos.CampaignDto::from)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private void applyCampaign(Campaign c, Dtos.CampaignRequest r) {
        c.setName(r.name());
        c.setDescription(r.description());
        c.setBannerText(r.bannerText());
        c.setStartsAt(r.startsAt());
        c.setEndsAt(r.endsAt());
        c.setActive(r.active());
    }

    private void apply(Coupon c, Dtos.CouponRequest r) {
        if (r.validTo().isBefore(r.validFrom())) throw new BadRequestException("validTo must be after validFrom");
        if (r.discountType() == Coupon.DiscountType.PERCENTAGE && r.discountValue().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new BadRequestException("A percentage discount cannot exceed 100");
        }
        c.setCode(r.code().trim().toUpperCase());
        c.setDescription(r.description());
        c.setDiscountType(r.discountType());
        c.setDiscountValue(r.discountValue());
        c.setMinOrderValue(r.minOrderValue() == null ? BigDecimal.ZERO : r.minOrderValue());
        c.setMaxDiscount(r.maxDiscount());
        c.setValidFrom(r.validFrom());
        c.setValidTo(r.validTo());
        c.setTotalUsageLimit(r.totalUsageLimit());
        c.setPerUserLimit(r.perUserLimit());
        c.setRestaurantId(r.restaurantId());
        c.setEligibleUserId(r.eligibleUserId());
        c.setCampaignId(r.campaignId());
    }

    private Coupon find(Long id) { return coupons.findById(id).orElseThrow(() -> new NotFoundException("Coupon", id)); }
}
