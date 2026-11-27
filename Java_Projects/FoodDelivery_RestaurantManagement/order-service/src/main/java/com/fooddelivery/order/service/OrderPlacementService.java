package com.fooddelivery.order.service;

import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.order.client.Clients;
import com.fooddelivery.order.client.Gateways;
import com.fooddelivery.order.client.ReactiveLookups;
import com.fooddelivery.order.domain.*;
import com.fooddelivery.order.event.OrderEventProducer;
import com.fooddelivery.order.repository.OrderRepository;
import com.fooddelivery.order.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Place-order use case (saga step 1-3):
 * <ol>
 *   <li>read the customer's cart selection (Feign) - never trust cart totals;</li>
 *   <li>in PARALLEL (WebClient + Mono.zip): customer, address, restaurant and authoritative menu pricing;</li>
 *   <li>check restaurant open/min-order, inventory (Feign) and the coupon (Feign) - all validated by the backend;</li>
 *   <li>ONE local DB transaction: save order, move CREATED -> PAYMENT_PENDING, queue order.created in the outbox.</li>
 * </ol>
 * Remote calls happen BEFORE the transaction (no DB connection is held while waiting on the network).
 * An optional Idempotency-Key makes a retried POST return the original order instead of creating a duplicate.
 */
@Service
public class OrderPlacementService {
    private static final Logger log = LoggerFactory.getLogger(OrderPlacementService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private final Gateways gateways;
    private final ReactiveLookups lookups;
    private final OrderRepository orders;
    private final OrderStateMachine machine;
    private final OrderEventProducer events;
    private final TransactionTemplate tx;
    private final BigDecimal taxRate;

    public OrderPlacementService(Gateways gateways, ReactiveLookups lookups, OrderRepository orders, OrderStateMachine machine,
                                 OrderEventProducer events, TransactionTemplate tx, @Value("${food.pricing.tax-rate:0.05}") BigDecimal taxRate) {
        this.gateways = gateways;
        this.lookups = lookups;
        this.orders = orders;
        this.machine = machine;
        this.events = events;
        this.tx = tx;
        this.taxRate = taxRate;
    }

    public Dtos.OrderDto place(Dtos.PlaceOrderRequest req, String idempotencyKey) {
        AuthUser user = SecurityUtils.requireUser();
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<CustomerOrder> existing = orders.findByCustomerIdAndIdempotencyKey(user.userId(), idempotencyKey);
            if (existing.isPresent()) {
                log.info("Idempotent replay of order placement key={} -> order {}", idempotencyKey, existing.get().getOrderNumber());
                return orders.findDetailed(existing.get().getId()).map(o -> Dtos.OrderDto.from(o, List.of())).orElseThrow();
            }
        }
        Clients.Selection selection = gateways.selection();
        if (selection == null || selection.lines() == null || selection.lines().isEmpty() || selection.restaurantId() == null) {
            throw new BadRequestException("CART_EMPTY", "Your cart is empty");
        }
        long rid = selection.restaurantId();
        var menuReq = new ReactiveLookups.MenuValidateRequest(rid, selection.lines().stream()
                .map(l -> new ReactiveLookups.MenuLine(l.menuItemId(), l.quantity(), l.variant(), l.addOnIds())).toList());

        // three independent remote calls, issued concurrently; block ONCE at this service boundary
        var tuple = Mono.zip(lookups.address(user.userId(), req.addressId()), lookups.restaurant(rid), lookups.priceMenu(menuReq), lookups.customer(user.userId()))
                .block(Duration.ofSeconds(10));
        var address = tuple.getT1();
        var restaurant = tuple.getT2();
        var priced = tuple.getT3();
        var customer = tuple.getT4();

        if (!"APPROVED".equals(restaurant.status())) throw new BadRequestException("RESTAURANT_UNAVAILABLE", restaurant.name() + " is not accepting orders");
        if (!restaurant.openNow()) throw new BadRequestException("RESTAURANT_CLOSED", restaurant.name() + " is currently closed");
        if ("BLOCKED".equals(customer.status())) throw new BusinessException(HttpStatus.FORBIDDEN, "CUSTOMER_BLOCKED", "Your account is blocked");
        BigDecimal subtotal = priced.subtotal();
        if (subtotal.compareTo(restaurant.minOrderAmount()) < 0) {
            throw new BadRequestException("MIN_ORDER", "Minimum order amount for this restaurant is " + restaurant.minOrderAmount());
        }

        var stock = gateways.inventory(new Clients.InvCheckRequest(rid, selection.lines().stream().map(l -> new Clients.InvCheckLine(l.menuItemId(), l.quantity())).toList()));
        if (!stock.available()) {
            String why = stock.shortages().stream().map(s -> s.ingredient()).distinct().collect(Collectors.joining(", "));
            throw new ConflictException("Some items cannot be prepared right now (insufficient stock of " + why + ")");
        }

        BigDecimal discount = BigDecimal.ZERO;
        String couponCode = null;
        String code = req.couponCode() != null && !req.couponCode().isBlank() ? req.couponCode() : selection.couponCode();
        if (code != null && !code.isBlank()) {
            var c = gateways.coupon(new Clients.CouponCheckRequest(code.trim(), user.userId(), rid, subtotal));
            if (!c.valid()) throw new BadRequestException("COUPON_INVALID", c.message());
            discount = c.discountAmount();
            couponCode = c.code();
        }
        BigDecimal taxable = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal tax = taxable.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = taxable.add(tax).add(restaurant.deliveryFee());

        final BigDecimal fDiscount = discount;
        final String fCoupon = couponCode;
        CustomerOrder saved = tx.execute(s -> {
            CustomerOrder o = new CustomerOrder();
            o.setOrderNumber("FD" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-" + randomSuffix());
            o.setIdempotencyKey(idempotencyKey == null || idempotencyKey.isBlank() ? null : idempotencyKey);
            o.setCustomerId(user.userId());
            o.setCustomerName(customer.fullName());
            o.setRestaurantId(rid);
            o.setRestaurantName(restaurant.name());
            o.setRestaurantOwnerUserId(restaurant.ownerUserId());
            o.setPickupAddress(restaurant.addressLine() + ", " + restaurant.city());
            o.setSubtotal(subtotal);
            o.setDiscountAmount(fDiscount);
            o.setCouponCode(fCoupon);
            o.setDeliveryFee(restaurant.deliveryFee());
            o.setTaxAmount(tax);
            o.setTotalAmount(total);
            o.setPaymentMethod(req.paymentMethod());
            o.setSpecialInstructions(req.specialInstructions());
            o.setEstimatedPrepMinutes(Math.max(priced.maxPrepTimeMinutes(), restaurant.prepTimeMinutes()));
            DeliveryAddress d = new DeliveryAddress();
            d.setLabel(address.label());
            d.setLine1(address.line1());
            d.setLine2(address.line2());
            d.setCity(address.city());
            d.setPostalCode(address.postalCode());
            d.setLatitude(address.latitude());
            d.setLongitude(address.longitude());
            o.setDeliveryAddress(d);
            for (int n = 0; n < priced.lines().size(); n++) {
                var p = priced.lines().get(n);
                OrderItem i = new OrderItem();
                i.setMenuItemId(p.menuItemId());
                i.setName(p.name());
                i.setVariant(p.variant());
                i.setAddOns(p.addOns() == null || p.addOns().isEmpty() ? null : String.join(", ", p.addOns()));
                i.setQuantity(p.quantity());
                i.setUnitPrice(p.unitPrice());
                i.setLineTotal(p.lineTotal());
                i.setInstructions(selection.lines().get(n).instructions());
                o.addItem(i);
            }
            OrderStatusHistory h = new OrderStatusHistory();
            h.setToStatus(OrderStatus.CREATED);
            h.setReason("Order placed");
            h.setActor("customer:" + user.userId());
            o.addHistory(h);
            orders.saveAndFlush(o);
            events.created(o);                                        // outbox row in the same transaction
            machine.transition(o, OrderStatus.PAYMENT_PENDING, "Awaiting payment", "system");
            return o;
        });
        log.info("Order {} placed by customer {} total={} restaurant={}", saved.getOrderNumber(), user.userId(), saved.getTotalAmount(), rid);
        return Dtos.OrderDto.from(orders.findDetailed(saved.getId()).orElseThrow(), List.of("CANCEL"));
    }

    private static String randomSuffix() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
        return sb.toString();
    }
}
