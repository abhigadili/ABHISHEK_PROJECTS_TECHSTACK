package com.fooddelivery.delivery.repository;

import com.fooddelivery.delivery.domain.DeliveryPartner;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface DeliveryPartnerRepository extends JpaRepository<DeliveryPartner, Long> {
    /** Candidates for an offer, locked so two simultaneous assignments cannot pick the same partner. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from DeliveryPartner p where p.online = true and p.busy = false and p.suspended = false order by p.lastAssignedAt asc nulls first, p.ratingAvg desc")
    List<DeliveryPartner> lockAvailable();

    long countByOnlineTrue();
    long countByBusyTrue();
}
