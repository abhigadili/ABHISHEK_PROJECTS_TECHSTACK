package com.fooddelivery.order.controller;

import com.fooddelivery.order.model.OrderCoupon;
import com.fooddelivery.order.service.OrderCouponService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/order-coupons")
public class OrderCouponController {

    private final OrderCouponService orderCouponService;

    public OrderCouponController(OrderCouponService orderCouponService) {
        this.orderCouponService = orderCouponService;
    }

    @GetMapping
    public Flux<OrderCoupon> findAll() {
        return orderCouponService.findAll();
    }

    @GetMapping("/{id}")
    public Mono<OrderCoupon> findById(@PathVariable Long id) {
        return orderCouponService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<OrderCoupon> create(@Valid @RequestBody OrderCoupon coupon) {
        return orderCouponService.create(coupon);
    }

    @PutMapping("/{id}")
    public Mono<OrderCoupon> update(@PathVariable Long id, @Valid @RequestBody OrderCoupon coupon) {
        return orderCouponService.update(id, coupon);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return orderCouponService.delete(id);
    }
}
