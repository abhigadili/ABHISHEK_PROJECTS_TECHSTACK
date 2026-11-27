package com.fooddelivery.order.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.order.domain.OrderStatus;
import com.fooddelivery.order.service.OrderPlacementService;
import com.fooddelivery.order.service.OrderQueryService;
import com.fooddelivery.order.service.OrderWorkflowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@Tag(name = "Orders")
public class OrderController {
    private static final String OWNER = "hasAnyRole('RESTAURANT_OWNER','RESTAURANT_STAFF','ADMIN','SUPER_ADMIN')";
    private static final String ADMIN = "hasAnyRole('ADMIN','SUPER_ADMIN')";
    private final OrderPlacementService placement;
    private final OrderWorkflowService workflow;
    private final OrderQueryService queries;

    public OrderController(OrderPlacementService placement, OrderWorkflowService workflow, OrderQueryService queries) {
        this.placement = placement;
        this.workflow = workflow;
        this.queries = queries;
    }

    @Operation(summary = "Place an order from the current cart. Optional Idempotency-Key header makes retries safe.")
    @PostMapping("/api/orders")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('CUSTOMER')")
    public Dtos.OrderDto place(@Valid @RequestBody Dtos.PlaceOrderRequest r, @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return placement.place(r, key);
    }

    @GetMapping("/api/orders/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    public PageResponse<Dtos.SummaryDto> mine(@RequestParam(required = false) OrderStatus status, @RequestParam(required = false) String q,
                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return queries.mine(status, q, page, size);
    }

    @GetMapping("/api/orders/{id}")
    public Dtos.OrderDto get(@PathVariable Long id) { return queries.get(id); }

    @GetMapping("/api/orders/{id}/history")
    public List<Dtos.HistoryDto> history(@PathVariable Long id) { return queries.history(id); }

    @PostMapping("/api/orders/{id}/cancel")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN','SUPER_ADMIN')")
    public Dtos.OrderDto cancel(@PathVariable Long id, @RequestBody(required = false) Dtos.ReasonRequest r) { return workflow.cancel(id, r == null ? null : r.reason()); }

    // ---- restaurant actions (the backend validates the transition; the client never sets a status)
    @GetMapping("/api/orders/restaurant/{restaurantId}")
    @PreAuthorize(OWNER)
    public PageResponse<Dtos.SummaryDto> forRestaurant(@PathVariable Long restaurantId, @RequestParam(required = false) OrderStatus status,
                                                       @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size) {
        return queries.forRestaurant(restaurantId, status, q, page, size);
    }

    @PostMapping("/api/orders/{id}/accept")
    @PreAuthorize(OWNER)
    public Dtos.OrderDto accept(@PathVariable Long id) { return workflow.accept(id); }

    @PostMapping("/api/orders/{id}/reject")
    @PreAuthorize(OWNER)
    public Dtos.OrderDto reject(@PathVariable Long id, @RequestBody(required = false) Dtos.ReasonRequest r) { return workflow.reject(id, r == null ? null : r.reason()); }

    @PostMapping("/api/orders/{id}/prepare")
    @PreAuthorize(OWNER)
    public Dtos.OrderDto prepare(@PathVariable Long id) { return workflow.startPreparing(id); }

    @PostMapping("/api/orders/{id}/ready")
    @PreAuthorize(OWNER)
    public Dtos.OrderDto ready(@PathVariable Long id) { return workflow.markReady(id); }

    // ---- admin
    @GetMapping("/api/orders")
    @PreAuthorize(ADMIN)
    public PageResponse<Dtos.SummaryDto> adminSearch(@RequestParam(required = false) Long restaurantId, @RequestParam(required = false) Long customerId,
                                                     @RequestParam(required = false) OrderStatus status, @RequestParam(required = false) String q,
                                                     @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                                     @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return queries.adminSearch(restaurantId, customerId, status, q, from, to, page, size);
    }

    @GetMapping("/api/orders/stats")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','SERVICE')")
    public Dtos.Stats stats() { return queries.stats(); }

    // ---- internal (not exposed through the gateway)
    @GetMapping("/internal/orders/{id}")
    @PreAuthorize("hasAnyRole('SERVICE','ADMIN','SUPER_ADMIN')")
    public Dtos.OrderInfo info(@PathVariable Long id) { return queries.info(id); }
}
