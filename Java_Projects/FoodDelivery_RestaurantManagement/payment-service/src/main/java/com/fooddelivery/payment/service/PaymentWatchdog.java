package com.fooddelivery.payment.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Payment timeout: fails overdue PENDING payments so the order saga can compensate. */
@Component
public class PaymentWatchdog {
    private final PaymentService payments;

    public PaymentWatchdog(PaymentService payments) { this.payments = payments; }

    @Scheduled(fixedDelayString = "${food.payment.watchdog-ms:15000}", initialDelay = 20000)
    public void expire() { try { payments.expireOverdue(); } catch (Exception ignored) { /* retried next tick */ } }
}
