package com.fooddelivery.order.service;

import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.order.domain.CustomerOrder;
import com.fooddelivery.order.domain.OrderStatus;
import com.fooddelivery.order.repository.OrderRepository;
import com.fooddelivery.order.web.Dtos;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

/** Read side: order lists with search / filter / pagination (Criteria Specifications) and detail views. */
@Service
@Transactional(readOnly = true)
public class OrderQueryService {
    private static final List<OrderStatus> REVENUE = List.of(OrderStatus.CONFIRMED, OrderStatus.RESTAURANT_ACCEPTED, OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP, OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED);
    private final OrderRepository orders;

    public OrderQueryService(OrderRepository orders) { this.orders = orders; }

    public Dtos.OrderDto get(Long id) {
        AuthUser u = SecurityUtils.requireUser();
        CustomerOrder o = orders.findDetailed(id).orElseThrow(() -> new NotFoundException("Order", id));
        boolean allowed = u.isAdmin() || u.isService() || u.userId() == o.getCustomerId() || u.userId() == o.getRestaurantOwnerUserId();
        if (!allowed) throw new ForbiddenException("You cannot view this order");
        return Dtos.OrderDto.from(o, OrderWorkflowService.allowedActions(o, u));
    }

    public List<Dtos.HistoryDto> history(Long id) { return get(id).history(); }

    public Dtos.OrderInfo info(Long id) {
        return orders.findDetailed(id).map(Dtos.OrderInfo::from).orElseThrow(() -> new NotFoundException("Order", id));
    }

    public PageResponse<Dtos.SummaryDto> mine(OrderStatus status, String q, int page, int size) {
        long me = SecurityUtils.requireUser().userId();
        return search(null, me, null, status, q, null, null, page, size);
    }

    public PageResponse<Dtos.SummaryDto> forRestaurant(Long restaurantId, OrderStatus status, String q, int page, int size) {
        AuthUser u = SecurityUtils.requireUser();
        // ownership: the restaurant must have at least one order owned by the caller (or caller is admin)
        if (!u.isAdmin()) {
            Specification<CustomerOrder> own = (r, cq, cb) -> cb.and(cb.equal(r.get("restaurantId"), restaurantId), cb.equal(r.get("restaurantOwnerUserId"), u.userId()));
            if (orders.count(own) == 0 && orders.count((r, cq, cb) -> cb.equal(r.get("restaurantId"), restaurantId)) > 0) throw new ForbiddenException("Not your restaurant");
        }
        return search(restaurantId, null, null, status, q, null, null, page, size);
    }

    public PageResponse<Dtos.SummaryDto> search(Long restaurantId, Long customerId, Long ignored, OrderStatus status, String q, Instant from, Instant to,
                                                int page, int size) {
        Specification<CustomerOrder> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (restaurantId != null) p.add(cb.equal(root.get("restaurantId"), restaurantId));
            if (customerId != null) p.add(cb.equal(root.get("customerId"), customerId));
            if (status != null) p.add(cb.equal(root.get("status"), status));
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase().trim() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("orderNumber")), like), cb.like(cb.lower(root.get("restaurantName")), like), cb.like(cb.lower(root.get("customerName")), like)));
            }
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            if (to != null) p.add(cb.lessThan(root.get("createdAt"), to));
            return cb.and(p.toArray(Predicate[]::new));
        };
        Page<CustomerOrder> pg = orders.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        pg.getContent().forEach(o -> o.getItems().size());     // initialised in-transaction (batch fetch avoids N+1)
        return PageResponse.of(pg, Dtos.SummaryDto::from);
    }

    public PageResponse<Dtos.SummaryDto> adminSearch(Long restaurantId, Long customerId, OrderStatus status, String q, Instant from, Instant to, int page, int size) {
        return search(restaurantId, customerId, null, status, q, from, to, page, size);
    }

    public Dtos.Stats stats() {
        Map<String, Long> byStatus = new LinkedHashMap<>();
        long total = 0;
        for (OrderStatus s : OrderStatus.values()) byStatus.put(s.name(), 0L);
        for (Object[] row : orders.countByStatus()) { byStatus.put(((OrderStatus) row[0]).name(), (Long) row[1]); total += (Long) row[1]; }
        Instant today = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant();
        Object[] rev = orders.revenueSince(today, REVENUE).get(0);
        return new Dtos.Stats(byStatus, (Long) rev[0], (BigDecimal) rev[1], total);
    }
}
