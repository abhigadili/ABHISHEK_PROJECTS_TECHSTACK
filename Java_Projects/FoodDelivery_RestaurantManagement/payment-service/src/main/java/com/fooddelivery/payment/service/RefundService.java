package com.fooddelivery.payment.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.payment.domain.Payment;
import com.fooddelivery.payment.domain.Refund;
import com.fooddelivery.payment.event.PaymentEventProducer;
import com.fooddelivery.payment.provider.PaymentProvider;
import com.fooddelivery.payment.provider.ProviderRegistry;
import com.fooddelivery.payment.repository.RefundRepository;
import com.fooddelivery.payment.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/** Refund processing: a worker picks up INITIATED refunds, calls the provider and records COMPLETED/FAILED (events follow). */
@Service
public class RefundService {
    private static final Logger log = LoggerFactory.getLogger(RefundService.class);
    private final RefundRepository refunds;
    private final PaymentProvider provider;
    private final PaymentEventProducer events;

    public RefundService(RefundRepository refunds, ProviderRegistry providers, PaymentEventProducer events) {
        this.refunds = refunds;
        this.provider = providers.active();
        this.events = events;
    }

    @Transactional
    public int processBatch() {
        int n = 0;
        for (Refund r : refunds.findTop20ByStatusOrderByCreatedAtAsc(Refund.Status.INITIATED)) {
            Payment p = r.getPayment();
            r.setAttempts(r.getAttempts() + 1);
            var res = provider.refund(new PaymentProvider.RefundRequest(r.getOrderId(), p.getProviderRef(), r.getAmount(), p.getScenario()));
            if (res.success()) {
                r.setStatus(Refund.Status.COMPLETED);
                r.setProviderRef(res.providerRef());
                r.setCompletedAt(Instant.now());
                r.setFailureReason(null);
                p.setStatus(Payment.Status.REFUNDED);
                log.info("Refund {} completed for order {}", r.getId(), r.getOrderId());
            } else {
                r.setStatus(Refund.Status.FAILED);
                r.setFailureReason(res.failureReason());
                log.error("Refund {} FAILED for order {}: {}", r.getId(), r.getOrderId(), res.failureReason());
            }
            events.refundCompleted(r, p);
            n++;
        }
        return n;
    }

    /** Admin retry of a failed refund (permission PERM_REFUND_MANAGE). The sandbox scenario is cleared so the retry can succeed. */
    @Audited("REFUND_RETRY")
    @Transactional
    public Dtos.RefundDto retry(Long id) {
        Refund r = refunds.findById(id).orElseThrow(() -> new NotFoundException("Refund", id));
        if (r.getStatus() != Refund.Status.FAILED) throw new BusinessException(HttpStatus.CONFLICT, "NOT_RETRYABLE", "Only FAILED refunds can be retried (this one is " + r.getStatus() + ")");
        r.getPayment().setScenario(null);
        r.setStatus(Refund.Status.INITIATED);
        return Dtos.RefundDto.from(r);
    }

    @Transactional(readOnly = true)
    public Page<Dtos.RefundDto> list(Refund.Status status, int page, int size) {
        var pr = PageRequest.of(page, Math.min(size, 100));
        return (status == null ? refunds.findAllByOrderByCreatedAtDesc(pr) : refunds.findByStatusOrderByCreatedAtDesc(status, pr)).map(Dtos.RefundDto::from);
    }

    @Transactional(readOnly = true)
    public Dtos.RefundDto forOrder(Long orderId) {
        return refunds.findByOrderId(orderId).map(Dtos.RefundDto::from).orElseThrow(() -> new NotFoundException("Refund for order", orderId));
    }
}
