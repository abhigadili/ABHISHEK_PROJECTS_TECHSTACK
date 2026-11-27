package com.hospital.billing.service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.hospital.billing.domain.*;
import com.hospital.common.events.NotificationRequestedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.EventPublisher;

import lombok.extern.log4j.Log4j2;

/** Scheduled billing housekeeping - all timings come from configuration. */
@Log4j2
@Component
public class BillingJobs {
    private final PaymentRepository payments;
    private final BillRepository bills;
    private final BillingService billing;
    private final EventPublisher events;
    private final TransactionTemplate tx;
    private final Duration paymentTimeout;
    private final Duration reminderInterval;

    public BillingJobs(PaymentRepository payments, BillRepository bills, BillingService billing, EventPublisher events, TransactionTemplate tx,
                       @Value("${hospital.billing.pending-payment-timeout-minutes:30}") long timeoutMinutes,
                       @Value("${hospital.billing.reminder-interval-hours:24}") long reminderHours) {
        this.payments = payments;
        this.bills = bills;
        this.billing = billing;
        this.events = events;
        this.tx = tx;
        this.paymentTimeout = Duration.ofMinutes(timeoutMinutes);
        this.reminderInterval = Duration.ofHours(reminderHours);
    }

    /** Payments stuck in PENDING (customer never completed the gateway step) are failed, which also notifies the patient. */
    @Scheduled(fixedDelayString = "${hospital.scheduler.pending-payments.fixed-delay-ms:60000}", initialDelayString = "${hospital.scheduler.initial-delay-ms:30000}")
    public void failStalePayments() {
        tx.executeWithoutResult(s -> {
            List<Payment> stale = payments.findByStatusAndInitiatedAtBefore(PaymentStatus.PENDING, Instant.now().minus(paymentTimeout));
            stale.forEach(p -> billing.settle(p, PaymentStatus.FAILED, "Timed out waiting for payment confirmation"));
            if (!stale.isEmpty()) log.info("Pending-payment job: {} payment(s) timed out", stale.size());
        });
    }

    /** Marks bills past their due date OVERDUE and reminds the patient (at most once per reminder interval). */
    @Scheduled(fixedDelayString = "${hospital.scheduler.overdue.fixed-delay-ms:300000}", initialDelayString = "${hospital.scheduler.initial-delay-ms:30000}")
    public void overdueAndReminders() {
        tx.executeWithoutResult(s -> {
            bills.findByStatusAndDueDateBefore(BillStatus.PENDING, LocalDate.now()).forEach(b -> {
                b.setStatus(BillStatus.OVERDUE);
                log.info("Bill {} is now OVERDUE", b.getBillNumber());
            });
            Instant now = Instant.now();
            int n = 0;
            for (Bill b : bills.findRemindable(List.of(BillStatus.PENDING, BillStatus.OVERDUE), now.minus(reminderInterval), now.minus(reminderInterval))) {
                if (b.getPatientEmail() == null) continue;
                events.publish(Topics.NOTIFICATION_REQUESTED, "bill-reminder-" + b.getId(), new NotificationRequestedEvent(EventPublisher.newId(), now,
                        b.getPatientEmail(), null, "EMAIL", "Payment reminder: " + b.getBillNumber(),
                        "Your bill " + b.getBillNumber() + " of " + b.outstanding() + " " + b.getCurrency() + " is " + b.getStatus().name().toLowerCase()
                                + " (due " + b.getDueDate() + "). Please complete the payment.", "PAYMENT_REMINDER", String.valueOf(b.getId())));
                b.setLastReminderAt(now);
                n++;
            }
            if (n > 0) log.info("Billing reminder job: {} reminder(s) queued", n);
        });
    }
}
