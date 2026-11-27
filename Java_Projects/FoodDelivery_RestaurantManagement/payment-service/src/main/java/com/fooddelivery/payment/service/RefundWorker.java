package com.fooddelivery.payment.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Refund processing loop. Lives in its own bean so the call to {@code processBatch()} goes through the transactional proxy. */
@Component
public class RefundWorker {
    private static final Logger log = LoggerFactory.getLogger(RefundWorker.class);
    private final RefundService refunds;

    public RefundWorker(RefundService refunds) { this.refunds = refunds; }

    @Scheduled(fixedDelayString = "${food.payment.refund-poll-ms:3000}", initialDelay = 8000)
    public void run() {
        try { refunds.processBatch(); } catch (Exception e) { log.warn("Refund worker cycle failed: {}", e.getMessage()); }
    }
}
