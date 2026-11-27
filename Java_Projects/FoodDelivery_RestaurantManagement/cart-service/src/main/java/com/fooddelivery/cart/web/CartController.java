package com.fooddelivery.cart.web;

import com.fooddelivery.cart.service.CartService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
@PreAuthorize("hasRole('CUSTOMER')")
@Tag(name = "Cart")
public class CartController {
    private final CartService cart;

    public CartController(CartService cart) { this.cart = cart; }

    @GetMapping
    public Dtos.CartView view() { return cart.view(); }

    @GetMapping("/selection")
    public Dtos.Selection selection() { return cart.selection(); }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public Dtos.CartView add(@Valid @RequestBody Dtos.AddItemRequest r, @RequestParam(defaultValue = "false") boolean replace) {
        cart.addItem(r, replace);
        return cart.view();
    }

    @PatchMapping("/items/{id}")
    public Dtos.CartView update(@PathVariable Long id, @Valid @RequestBody Dtos.UpdateItemRequest r) {
        cart.updateItem(id, r);
        return cart.view();
    }

    @DeleteMapping("/items/{id}")
    public Dtos.CartView remove(@PathVariable Long id) {
        cart.removeItem(id);
        return cart.view();
    }

    @DeleteMapping
    public ResponseEntity<Void> clear() {
        cart.clear();
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/coupon")
    public Dtos.CartView coupon(@Valid @RequestBody Dtos.CouponRequest r) {
        cart.setCoupon(r.code());
        return cart.view();
    }

    @DeleteMapping("/coupon")
    public Dtos.CartView removeCoupon() {
        cart.removeCoupon();
        return cart.view();
    }
}
