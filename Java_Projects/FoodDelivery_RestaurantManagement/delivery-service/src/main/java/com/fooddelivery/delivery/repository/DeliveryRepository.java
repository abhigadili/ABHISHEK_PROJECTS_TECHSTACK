package com.fooddelivery.delivery.repository;

import com.fooddelivery.delivery.domain.Delivery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DeliveryRepository extends JpaRepository<Delivery, Long> {
    Optional<Delivery> findByOrderId(Long orderId);
    List<Delivery> findByPartnerUserIdAndStatusIn(Long partnerUserId, Collection<Delivery.Status> statuses);
    Page<Delivery> findByPartnerUserIdAndStatusOrderByDeliveredAtDesc(Long partnerUserId, Delivery.Status status, Pageable pageable);
    Page<Delivery> findByStatusOrderByCreatedAtDesc(Delivery.Status status, Pageable pageable);
    Page<Delivery> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<Delivery> findTop50ByStatusOrderByCreatedAtAsc(Delivery.Status status);
    List<Delivery> findTop50ByStatusAndAssignmentExpiresAtBefore(Delivery.Status status, Instant now);
    long countByStatus(Delivery.Status status);

    @Query("select d.status, count(d) from Delivery d group by d.status")
    List<Object[]> countsByStatus();

    @Query(nativeQuery = true, value = "select avg(timestampdiff(MINUTE, picked_up_at, delivered_at)) from deliveries where partner_user_id = :partner and status = 'DELIVERED' and picked_up_at is not null")
    Double averageDeliveryMinutes(Long partner);
}
