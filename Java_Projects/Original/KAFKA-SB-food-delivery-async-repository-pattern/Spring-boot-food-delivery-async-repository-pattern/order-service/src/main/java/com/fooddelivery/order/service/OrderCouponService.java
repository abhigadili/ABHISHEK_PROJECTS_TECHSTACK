package com.fooddelivery.order.service;

import com.fooddelivery.order.exception.ResourceNotFoundException;
import com.fooddelivery.order.model.OrderCoupon;
import com.fooddelivery.order.repository.OrderCouponRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class OrderCouponService {

    private final OrderCouponRepository orderCouponRepository;

    public OrderCouponService(OrderCouponRepository orderCouponRepository) {
        this.orderCouponRepository = orderCouponRepository;
    }

    public Flux<OrderCoupon> findAll() {
        return orderCouponRepository.findAll();
    }

    public Mono<OrderCoupon> findById(Long id) {
        return orderCouponRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Coupon not found: " + id)));
    }

    public Mono<OrderCoupon> create(OrderCoupon coupon) {
        OrderCoupon toSave = new OrderCoupon(null, coupon.code(), coupon.description(), coupon.discountPercent(),
                coupon.discountAmount(), coupon.minOrderAmount(), coupon.validFrom(), coupon.validTo(),
                coupon.usageLimit() != null ? coupon.usageLimit() : 0,
                coupon.timesUsed() != null ? coupon.timesUsed() : 0,
                coupon.isActive() != null ? coupon.isActive() : Boolean.TRUE);
        return orderCouponRepository.save(toSave);
    }

    public Mono<OrderCoupon> update(Long id, OrderCoupon coupon) {
        return findById(id)
                .map(existing -> new OrderCoupon(id, coupon.code(), coupon.description(), coupon.discountPercent(),
                        coupon.discountAmount(), coupon.minOrderAmount(), coupon.validFrom(), coupon.validTo(),
                        coupon.usageLimit(), coupon.timesUsed(), coupon.isActive()))
                .flatMap(orderCouponRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(orderCouponRepository::delete);
    }
}
