package com.fooddelivery.cart.service;

import com.fooddelivery.cart.client.CouponClient;
import com.fooddelivery.cart.client.Gateways;
import com.fooddelivery.cart.client.MenuPricingClient;
import com.fooddelivery.cart.client.RestaurantClient;
import com.fooddelivery.cart.domain.Cart;
import com.fooddelivery.cart.domain.CartItem;
import com.fooddelivery.cart.repository.CartRepository;
import com.fooddelivery.cart.web.Dtos;
import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.exception.RemoteServiceException;
import com.fooddelivery.common.security.SecurityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Cart rules: ONE restaurant per cart (adding from another restaurant is refused with 409 unless replace=true).
 * The cart stores only the customer's selection; all prices, availability, discounts, fees and taxes are
 * recomputed on the server on every read (cached in Redis for one minute, evicted on every change).
 */
@Service
public class CartService {
    private static final Logger log = LoggerFactory.getLogger(CartService.class);
    private static final String KEY = "T(com.fooddelivery.common.security.SecurityUtils).requireUser().userId()";
    private final CartRepository carts;
    private final MenuPricingClient menu;
    private final Gateways gateways;
    private final BigDecimal taxRate;

    public CartService(CartRepository carts, MenuPricingClient menu, Gateways gateways, @Value("${food.pricing.tax-rate:0.05}") BigDecimal taxRate) {
        this.carts = carts;
        this.menu = menu;
        this.gateways = gateways;
        this.taxRate = taxRate;
    }

    @Transactional
    @CacheEvict(cacheNames = "cart", key = KEY)
    public void addItem(Dtos.AddItemRequest r, boolean replace) {
        long customerId = SecurityUtils.requireUser().userId();
        Cart cart = carts.findByCustomerId(customerId).orElseGet(() -> {
            Cart c = new Cart();
            c.setCustomerId(customerId);
            return carts.save(c);
        });
        if (cart.getRestaurantId() != null && !cart.getRestaurantId().equals(r.restaurantId()) && !cart.getItems().isEmpty()) {
            if (!replace) throw new ConflictException("CART_OTHER_RESTAURANT: your cart contains items from another restaurant. Clear it or pass replace=true");
            cart.getItems().clear();
            cart.setCouponCode(null);
        }
        // validates ownership by restaurant, availability, variant and add-ons BEFORE anything is stored
        var priced = menu.validate(r.restaurantId(), List.of(new MenuPricingClient.Line(r.menuItemId(), r.quantity(), r.variant(), r.addOnIds())));
        cart.setRestaurantId(r.restaurantId());
        String addOns = r.addOnIds() == null ? null : r.addOnIds().stream().sorted().map(String::valueOf).collect(Collectors.joining(","));
        String ins = r.instructions() == null || r.instructions().isBlank() ? null : r.instructions().trim();
        Optional<CartItem> same = cart.getItems().stream().filter(i -> i.getMenuItemId().equals(r.menuItemId())
                && Objects.equals(i.getVariant(), blankToNull(r.variant())) && Objects.equals(i.getAddOnIds(), blankToNull(addOns))
                && Objects.equals(i.getInstructions(), ins)).findFirst();
        if (same.isPresent()) {
            int q = same.get().getQuantity() + r.quantity();
            if (q > 50) throw new BadRequestException("Maximum 50 units per line");
            same.get().setQuantity(q);
        } else {
            CartItem i = new CartItem();
            i.setCart(cart);
            i.setMenuItemId(r.menuItemId());
            i.setName(priced.lines().get(0).name());
            i.setVariant(blankToNull(r.variant()));
            i.setAddOnIds(blankToNull(addOns));
            i.setQuantity(r.quantity());
            i.setUnitPriceSnapshot(priced.lines().get(0).unitPrice());
            i.setInstructions(ins);
            cart.getItems().add(i);
        }
        log.info("Cart item added customer={} item={} qty={}", customerId, r.menuItemId(), r.quantity());
    }

    @Transactional
    @CacheEvict(cacheNames = "cart", key = KEY)
    public void updateItem(Long itemId, Dtos.UpdateItemRequest r) {
        CartItem i = ownItem(itemId);
        if (r.quantity() != null) i.setQuantity(r.quantity());
        if (r.instructions() != null) i.setInstructions(blankToNull(r.instructions()));
    }

    @Transactional
    @CacheEvict(cacheNames = "cart", key = KEY)
    public void removeItem(Long itemId) {
        Cart cart = current();
        CartItem i = cart.getItems().stream().filter(x -> x.getId().equals(itemId)).findFirst().orElseThrow(() -> new NotFoundException("Cart item", itemId));
        cart.getItems().remove(i);
        if (cart.getItems().isEmpty()) { cart.setRestaurantId(null); cart.setCouponCode(null); }
    }

    @Transactional
    @CacheEvict(cacheNames = "cart", key = KEY)
    public void clear() { clearCart(current()); }

    @Transactional
    @CacheEvict(cacheNames = "cart", key = "#customerId")
    public void clearForCustomer(Long customerId, Long restaurantId) {
        carts.findByCustomerId(customerId).ifPresent(c -> {
            if (restaurantId == null || restaurantId.equals(c.getRestaurantId())) clearCart(c);
        });
    }

    @Transactional
    @CacheEvict(cacheNames = "cart", key = KEY)
    public void setCoupon(String code) {
        Cart c = current();
        if (c.getItems().isEmpty()) throw new BadRequestException("Add items before applying a coupon");
        c.setCouponCode(code.trim().toUpperCase());
    }

    @Transactional
    @CacheEvict(cacheNames = "cart", key = KEY)
    public void removeCoupon() { current().setCouponCode(null); }

    @Transactional(readOnly = true)
    public Dtos.Selection selection() {
        // a customer who never touched the cart simply has an empty selection (the order service answers "cart is empty")
        return carts.findByCustomerId(SecurityUtils.requireUser().userId())
                .map(c -> new Dtos.Selection(c.getRestaurantId(), c.getCouponCode(), c.getItems().stream().map(i -> new Dtos.SelectionLine(i.getMenuItemId(),
                        i.getQuantity(), i.getVariant(), parseIds(i.getAddOnIds()), i.getInstructions())).toList()))
                .orElseGet(() -> new Dtos.Selection(null, null, List.of()));
    }

    /** Priced cart view: authoritative prices from menu-service, restaurant rules, coupon discount, delivery fee, tax. */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "cart", key = KEY)
    public Dtos.CartView view() {
        Cart cart = carts.findByCustomerId(SecurityUtils.requireUser().userId()).orElse(null);
        if (cart == null || cart.getItems().isEmpty()) return Dtos.CartView.empty();
        ArrayList<String> issues = new ArrayList<>();
        RestaurantClient.RestaurantInfo rest;
        try { rest = gateways.restaurant(cart.getRestaurantId()); }
        catch (RemoteServiceException e) { throw e; }
        List<MenuPricingClient.Line> lines = cart.getItems().stream()
                .map(i -> new MenuPricingClient.Line(i.getMenuItemId(), i.getQuantity(), i.getVariant(), parseIds(i.getAddOnIds()))).toList();
        ArrayList<Dtos.LineView> views = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        try {
            var priced = menu.validate(cart.getRestaurantId(), lines);
            for (int n = 0; n < cart.getItems().size(); n++) {
                CartItem ci = cart.getItems().get(n);
                var p = priced.lines().get(n);
                views.add(new Dtos.LineView(ci.getId(), ci.getMenuItemId(), p.name(), p.variant(), new ArrayList<>(p.addOns()), p.quantity(),
                        p.unitPrice(), p.lineTotal(), ci.getInstructions(), p.vegetarian()));
            }
            subtotal = priced.subtotal();
        } catch (RemoteServiceException e) {
            issues.add(e.getMessage());                    // e.g. an item became unavailable: show the problem, do not crash
            for (CartItem ci : cart.getItems()) {
                BigDecimal t = ci.getUnitPriceSnapshot().multiply(BigDecimal.valueOf(ci.getQuantity()));
                views.add(new Dtos.LineView(ci.getId(), ci.getMenuItemId(), ci.getName(), ci.getVariant(), new ArrayList<>(), ci.getQuantity(),
                        ci.getUnitPriceSnapshot(), t, ci.getInstructions(), false));
                subtotal = subtotal.add(t);
            }
        }
        BigDecimal discount = BigDecimal.ZERO;
        String couponMessage = null;
        if (cart.getCouponCode() != null) {
            var res = gateways.coupon(new CouponClient.CheckRequest(cart.getCouponCode(), cart.getCustomerId(), cart.getRestaurantId(), subtotal));
            couponMessage = res.message();
            if (res.valid()) discount = res.discountAmount();
        }
        BigDecimal taxable = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal tax = taxable.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal fee = rest.deliveryFee();
        BigDecimal total = taxable.add(tax).add(fee);
        boolean minOk = subtotal.compareTo(rest.minOrderAmount()) >= 0;
        if (!minOk) issues.add("Minimum order amount is " + rest.minOrderAmount());
        if (!rest.openNow()) issues.add(rest.name() + " is currently closed");
        if (!"APPROVED".equals(rest.status())) issues.add(rest.name() + " is not accepting orders");
        return new Dtos.CartView(cart.getRestaurantId(), rest.name(), views, subtotal, discount, cart.getCouponCode(), couponMessage, fee, tax, total,
                rest.minOrderAmount(), minOk, rest.openNow(), issues, issues.isEmpty());
    }

    private Cart current() {
        return carts.findByCustomerId(SecurityUtils.requireUser().userId()).orElseThrow(() -> new NotFoundException("Cart", "current"));
    }

    private CartItem ownItem(Long id) {
        return current().getItems().stream().filter(i -> i.getId().equals(id)).findFirst().orElseThrow(() -> new NotFoundException("Cart item", id));
    }

    private void clearCart(Cart c) {
        c.getItems().clear();
        c.setRestaurantId(null);
        c.setCouponCode(null);
    }

    private static List<Long> parseIds(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(",")).map(Long::valueOf).toList();
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
}
