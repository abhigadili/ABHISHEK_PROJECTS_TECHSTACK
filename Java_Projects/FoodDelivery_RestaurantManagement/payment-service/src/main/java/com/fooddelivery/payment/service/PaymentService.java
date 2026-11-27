package com.fooddelivery.payment.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.payment.client.OrderGateway;
import com.fooddelivery.payment.domain.*;
import com.fooddelivery.payment.event.PaymentEventProducer;
import com.fooddelivery.payment.provider.PaymentProvider;
import com.fooddelivery.payment.provider.ProviderRegistry;
import com.fooddelivery.payment.repository.*;
import com.fooddelivery.payment.web.Dtos;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Payment lifecycle. Rules that protect money:
 * <ul>
 *   <li>amount comes from the order service (authoritative) and must match the order.created event;</li>
 *   <li>one payment per order (unique) and an Idempotency-Key ledger: a retried "pay" never charges twice;</li>
 *   <li>provider callbacks are signed (HMAC) and de-duplicated by provider event id;</li>
 *   <li>only PENDING payments can be paid; SUCCESS/FAILED/CANCELLED are final (REFUNDED only after SUCCESS);</li>
 *   <li>no card data is ever stored or logged.</li>
 * </ul>
 */
@Service
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private final PaymentRepository payments;
    private final RefundRepository refunds;
    private final AttemptRecordRepository attempts;
    private final CallbackLedgerRepository callbacks;
    private final SavedMethodRepository saved;
    private final PaymentProvider provider;
    private final PaymentEventProducer events;
    private final OrderGateway orders;
    private final Duration pendingTtl;

    public PaymentService(PaymentRepository payments, RefundRepository refunds, AttemptRecordRepository attempts, CallbackLedgerRepository callbacks,
                          SavedMethodRepository saved, ProviderRegistry providers, PaymentEventProducer events, OrderGateway orders,
                          @Value("${food.payment.pending-ttl:10m}") Duration pendingTtl) {
        this.payments = payments;
        this.refunds = refunds;
        this.attempts = attempts;
        this.callbacks = callbacks;
        this.saved = saved;
        this.provider = providers.active();
        this.events = events;
        this.orders = orders;
        this.pendingTtl = pendingTtl;
    }

    // ------------------------------------------------------------ Kafka-driven
    /** order.created -> create the pending payment (idempotent per order). The amount is verified against the order service. */
    @Transactional
    public void onOrderCreated(Events.OrderCreated e) {
        if (payments.findByOrderId(e.orderId()).isPresent()) { log.info("Payment for order {} already exists", e.orderId()); return; }
        var info = orders.info(e.orderId());                       // Feign + circuit breaker: authoritative amount and state
        if (info.totalAmount().compareTo(e.totalAmount()) != 0) throw new IllegalStateException("Amount mismatch for order " + e.orderId());
        if (!"PAYMENT_PENDING".equals(info.status())) { log.warn("Order {} is {}; no payment created", e.orderId(), info.status()); return; }
        Payment p = new Payment();
        p.setOrderId(info.id());
        p.setOrderNumber(info.orderNumber());
        p.setCustomerId(info.customerId());
        p.setAmount(info.totalAmount());
        p.setMethod(info.paymentMethod() == null ? "CARD" : info.paymentMethod());
        p.setProvider(provider.name());
        p.setSandbox(provider.isSandbox());
        p.setExpiresAt(Instant.now().plus(pendingTtl));
        payments.save(p);
        events.initiated(p);
        log.info("Payment {} initiated for order {} amount={} provider={} sandbox={}", p.getId(), p.getOrderNumber(), p.getAmount(), p.getProvider(), p.isSandbox());
    }

    /** order cancelled / rejected: stop a pending payment, or refund a successful one (regardless of event flags: closes every race). */
    @Transactional
    public void onOrderVoided(long orderId, String reason) {
        Optional<Payment> found = payments.findByOrderId(orderId);
        if (found.isEmpty()) { log.info("No payment exists yet for voided order {}", orderId); return; }
        Payment p = found.get();
        switch (p.getStatus()) {
            case PENDING -> { p.setStatus(Payment.Status.CANCELLED); p.setFailureReason(reason); log.info("Pending payment {} cancelled (order voided)", p.getId()); }
            case SUCCESS -> startRefund(p, reason);
            default -> log.info("Payment {} is {}; nothing to void", p.getId(), p.getStatus());
        }
    }

    private void startRefund(Payment p, String reason) {
        if (refunds.findByPaymentId(p.getId()).isPresent()) return;       // idempotent
        Refund r = new Refund();
        r.setPayment(p);
        r.setOrderId(p.getOrderId());
        r.setAmount(p.getAmount());
        r.setReason(reason);
        refunds.save(r);
        events.refundInitiated(r, p);
        log.info("Refund {} initiated for payment {} amount={}", r.getId(), p.getId(), r.getAmount());
    }

    // ------------------------------------------------------------ customer API
    @Transactional
    public Dtos.PaymentDto pay(Long orderId, Dtos.PayRequest req, String idempotencyKey) {
        AuthUser u = SecurityUtils.requireUser();
        Payment p = payments.findByOrderId(orderId).orElseThrow(() -> new NotFoundException("Payment for order", orderId));
        if (u.userId() != p.getCustomerId()) throw new ForbiddenException("This is not your payment");
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            var prior = attempts.findByCustomerIdAndIdempotencyKey(u.userId(), idempotencyKey);
            if (prior.isPresent()) { log.info("Idempotent replay of pay key={}", idempotencyKey); return Dtos.PaymentDto.from(p); }
        }
        if (p.getStatus() == Payment.Status.SUCCESS) return Dtos.PaymentDto.from(p);      // already paid: same answer, no second charge
        if (p.getStatus() != Payment.Status.PENDING) throw new BusinessException(HttpStatus.CONFLICT, "PAYMENT_CLOSED", "Payment is " + p.getStatus() + " and can no longer be paid");
        if (p.getExpiresAt().isBefore(Instant.now())) throw new BusinessException(HttpStatus.CONFLICT, "PAYMENT_EXPIRED", "Payment window has expired");

        String token = req == null ? null : req.paymentToken();
        String method = req != null && req.method() != null ? req.method() : p.getMethod();
        if (req != null && req.savedMethodId() != null) {
            SavedMethod m = saved.findByIdAndCustomerId(req.savedMethodId(), u.userId()).orElseThrow(() -> new NotFoundException("Saved payment method", req.savedMethodId()));
            token = m.getProviderToken();
            method = m.getType();
        }
        var res = provider.charge(new PaymentProvider.ChargeRequest(p.getOrderId(), p.getOrderNumber(), p.getAmount(), p.getCurrency(), method, token));
        p.setMethod(method);
        p.setScenario("tok_refund_fail".equals(token) ? token : null);
        applyOutcome(p, res.success(), res.providerRef(), res.failureReason());
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            AttemptRecord a = new AttemptRecord();
            a.setCustomerId(u.userId());
            a.setIdempotencyKey(idempotencyKey);
            a.setPaymentId(p.getId());
            a.setResultStatus(p.getStatus().name());
            attempts.save(a);
        }
        return Dtos.PaymentDto.from(p);
    }

    /** Signed provider webhook: applies at most once per providerEventId. */
    @Transactional
    public Dtos.CallbackResponse callback(Dtos.CallbackRequest c) {
        if (callbacks.existsByProviderEventId(c.providerEventId())) {
            log.info("Duplicate payment callback {} ignored", c.providerEventId());
            return new Dtos.CallbackResponse(false, true, "Duplicate callback ignored");
        }
        try {
            CallbackLedger l = new CallbackLedger();
            l.setProviderEventId(c.providerEventId());
            l.setOrderId(c.orderId());
            l.setOutcome(c.status());
            callbacks.saveAndFlush(l);
        } catch (DataIntegrityViolationException race) {
            return new Dtos.CallbackResponse(false, true, "Duplicate callback ignored");
        }
        Payment p = payments.findByOrderId(c.orderId()).orElseThrow(() -> new NotFoundException("Payment for order", c.orderId()));
        if (p.getStatus() != Payment.Status.PENDING) return new Dtos.CallbackResponse(false, false, "Payment already " + p.getStatus());
        applyOutcome(p, "SUCCESS".equals(c.status()), c.transactionRef(), c.reason());
        return new Dtos.CallbackResponse(true, false, "Applied: " + p.getStatus());
    }

    private void applyOutcome(Payment p, boolean success, String ref, String failure) {
        if (success) {
            p.setStatus(Payment.Status.SUCCESS);
            p.setProviderRef(ref);
            p.setPaidAt(Instant.now());
            p.setFailureReason(null);
            events.success(p);
            log.info("Payment {} succeeded for order {} (provider={}, sandbox={})", p.getId(), p.getOrderNumber(), p.getProvider(), p.isSandbox());
        } else {
            p.setStatus(Payment.Status.FAILED);
            p.setFailureReason(failure == null ? "Payment declined" : failure);
            events.failed(p, p.getFailureReason());
            log.warn("Payment {} failed for order {}: {}", p.getId(), p.getOrderNumber(), p.getFailureReason());
        }
    }

    @Transactional(readOnly = true)
    public Dtos.PaymentDto forOrder(Long orderId) {
        AuthUser u = SecurityUtils.requireUser();
        Payment p = payments.findByOrderId(orderId).orElseThrow(() -> new NotFoundException("Payment for order", orderId));
        if (!u.isAdmin() && !u.isService() && u.userId() != p.getCustomerId()) throw new ForbiddenException("This is not your payment");
        return Dtos.PaymentDto.from(p);
    }

    @Transactional(readOnly = true)
    public List<Dtos.PaymentDto> mine() {
        return payments.findByCustomerIdOrderByCreatedAtDesc(SecurityUtils.requireUser().userId()).stream().map(Dtos.PaymentDto::from).toList();
    }

    // ------------------------------------------------------------ timeout watchdog
    /** Called by the scheduler: unpaid payments past their window fail, which in turn fails the order (saga compensation). */
    @Transactional
    public int expireOverdue() {
        int n = 0;
        for (Payment p : payments.findTop100ByStatusAndExpiresAtBefore(Payment.Status.PENDING, Instant.now())) {
            p.setStatus(Payment.Status.FAILED);
            p.setFailureReason("Payment timed out");
            events.failed(p, "TIMEOUT: payment was not completed within " + pendingTtl.toMinutes() + " minutes");
            n++;
        }
        if (n > 0) log.warn("{} pending payment(s) timed out", n);
        return n;
    }

    // ------------------------------------------------------------ admin
    @Transactional(readOnly = true)
    public Page<Dtos.PaymentDto> search(Payment.Status status, Long customerId, String q, int page, int size) {
        Specification<Payment> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (status != null) p.add(cb.equal(root.get("status"), status));
            if (customerId != null) p.add(cb.equal(root.get("customerId"), customerId));
            if (q != null && !q.isBlank()) p.add(cb.like(cb.lower(root.get("orderNumber")), "%" + q.toLowerCase().trim() + "%"));
            return cb.and(p.toArray(Predicate[]::new));
        };
        return payments.findAll(spec, PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt"))).map(Dtos.PaymentDto::from);
    }

    @Transactional(readOnly = true)
    public Dtos.Summary summary() {
        Map<String, Long> counts = new LinkedHashMap<>();
        Map<String, BigDecimal> amounts = new LinkedHashMap<>();
        for (Payment.Status s : Payment.Status.values()) { counts.put(s.name(), 0L); amounts.put(s.name(), BigDecimal.ZERO); }
        for (Object[] r : payments.summary()) { counts.put(((Payment.Status) r[0]).name(), (Long) r[1]); amounts.put(((Payment.Status) r[0]).name(), (BigDecimal) r[2]); }
        return new Dtos.Summary(counts, amounts);
    }

    // ------------------------------------------------------------ saved methods
    @Transactional
    public Dtos.SavedMethodDto saveMethod(Dtos.SavedMethodRequest r) {
        long me = SecurityUtils.requireUser().userId();
        if (r.maskedValue().replaceAll("[^0-9]", "").length() > 6) throw new BadRequestException("Send only a masked value (e.g. **** 4242), never a full card number");
        if (r.makeDefault()) saved.findByCustomerIdOrderByIdDesc(me).forEach(m -> m.setDefaultMethod(false));
        SavedMethod m = new SavedMethod();
        m.setCustomerId(me);
        m.setType(r.type());
        m.setLabel(r.label());
        m.setMaskedValue(r.maskedValue());
        m.setProviderToken(r.providerToken());
        m.setDefaultMethod(r.makeDefault());
        return Dtos.SavedMethodDto.from(saved.save(m));
    }

    @Transactional(readOnly = true)
    public List<Dtos.SavedMethodDto> methods() {
        return saved.findByCustomerIdOrderByIdDesc(SecurityUtils.requireUser().userId()).stream().map(Dtos.SavedMethodDto::from).toList();
    }

    @Transactional
    public void deleteMethod(Long id) {
        saved.delete(saved.findByIdAndCustomerId(id, SecurityUtils.requireUser().userId()).orElseThrow(() -> new NotFoundException("Saved payment method", id)));
    }
}
