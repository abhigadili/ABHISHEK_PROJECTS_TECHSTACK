package com.fooddelivery.order.repository;

import com.fooddelivery.order.model.OrderCoupon;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface OrderCouponRepository extends ReactiveCrudRepository<OrderCoupon, Long> {

    Mono<OrderCoupon> findByCode(String code);
}
