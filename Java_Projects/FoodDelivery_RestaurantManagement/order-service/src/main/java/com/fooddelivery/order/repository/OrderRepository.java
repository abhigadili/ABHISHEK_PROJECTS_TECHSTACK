package com.fooddelivery.order.repository;

import com.fooddelivery.order.domain.CustomerOrder;
import com.fooddelivery.order.domain.OrderStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<CustomerOrder, Long>, JpaSpecificationExecutor<CustomerOrder> {
    /** Entity graph: items + history in the same query: no N+1 when showing an order. */
    @EntityGraph(attributePaths = {"items", "history"})
    @Query("select o from CustomerOrder o where o.id = :id")
    Optional<CustomerOrder> findDetailed(Long id);

    Optional<CustomerOrder> findByCustomerIdAndIdempotencyKey(Long customerId, String key);

    @Query("select o.status, count(o) from CustomerOrder o group by o.status")
    List<Object[]> countByStatus();

    @Query("select count(o), coalesce(sum(o.totalAmount),0) from CustomerOrder o where o.createdAt >= :since and o.status in :paid")
    List<Object[]> revenueSince(Instant since, List<OrderStatus> paid);

    boolean existsByCustomerIdAndRestaurantIdAndStatus(Long customerId, Long restaurantId, OrderStatus status);
}
