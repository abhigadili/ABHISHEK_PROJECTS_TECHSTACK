package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.domain.InboxOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface InboxOrderRepository extends JpaRepository<InboxOrder, Long> {
    Optional<InboxOrder> findByOrderId(Long orderId);
    Page<InboxOrder> findByRestaurantIdOrderByReceivedAtDesc(Long restaurantId, Pageable pageable);

    @Query("select o.status, count(o), coalesce(sum(o.totalAmount),0) from InboxOrder o where o.restaurantId = :rid group by o.status")
    List<Object[]> summarise(Long rid);
}
