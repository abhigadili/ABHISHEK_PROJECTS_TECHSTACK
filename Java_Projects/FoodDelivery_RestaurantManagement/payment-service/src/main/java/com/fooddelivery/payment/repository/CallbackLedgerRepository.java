package com.fooddelivery.payment.repository;

import com.fooddelivery.payment.domain.CallbackLedger;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CallbackLedgerRepository extends JpaRepository<CallbackLedger, Long> {
    boolean existsByProviderEventId(String providerEventId);
}
