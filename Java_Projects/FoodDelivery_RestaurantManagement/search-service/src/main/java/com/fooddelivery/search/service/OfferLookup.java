package com.fooddelivery.search.service;

import com.fooddelivery.common.http.RemoteClient;
import com.fooddelivery.search.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;

/** Available offers come from coupon-service (WebClient). Offers are a nice-to-have: failure degrades to "no offers". */
@Component
public class OfferLookup {
    private static final Logger log = LoggerFactory.getLogger(OfferLookup.class);
    public record Coupon(Long id, String code, String description, String discountType, BigDecimal discountValue, BigDecimal minOrderValue, Long restaurantId) {}
    private final RemoteClient remote;

    public OfferLookup(RemoteClient remote) { this.remote = remote; }

    public List<Dtos.OfferHit> offers(String term) {
        try {
            List<Coupon> coupons = remote.get("coupon-service", "/api/coupons/public/active", new ParameterizedTypeReference<List<Coupon>>() {})
                    .block(Duration.ofSeconds(3));
            if (coupons == null) return List.of();
            String t = term == null ? "" : term.toLowerCase();
            return coupons.stream().filter(c -> t.isEmpty() || c.code().toLowerCase().contains(t) || (c.description() != null && c.description().toLowerCase().contains(t)))
                    .map(c -> new Dtos.OfferHit(c.code(), c.description(), c.discountType(), c.discountValue(), c.minOrderValue(), c.restaurantId())).toList();
        } catch (Exception e) {
            log.warn("Offer lookup failed (returning no offers): {}", e.toString());
            return List.of();
        }
    }
}
