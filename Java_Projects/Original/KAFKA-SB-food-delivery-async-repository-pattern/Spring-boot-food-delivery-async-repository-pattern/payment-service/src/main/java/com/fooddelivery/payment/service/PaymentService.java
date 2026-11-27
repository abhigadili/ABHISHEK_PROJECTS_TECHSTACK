package com.fooddelivery.payment.service;

import com.fooddelivery.payment.event.OrderCreatedEvent;
import com.fooddelivery.payment.event.PaymentCompletedEvent;
import com.fooddelivery.payment.event.PaymentEventProducer;
import com.fooddelivery.payment.exception.ResourceNotFoundException;
import com.fooddelivery.payment.model.Payment;
import com.fooddelivery.payment.model.PaymentLog;
import com.fooddelivery.payment.repository.PaymentLogRepository;
import com.fooddelivery.payment.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentLogRepository paymentLogRepository;
    private final PaymentEventProducer paymentEventProducer;

    public PaymentService(PaymentRepository paymentRepository,
                           PaymentLogRepository paymentLogRepository,
                           PaymentEventProducer paymentEventProducer) {
        this.paymentRepository = paymentRepository;
        this.paymentLogRepository = paymentLogRepository;
        this.paymentEventProducer = paymentEventProducer;
    }

    public Flux<Payment> findAll(Long orderId) {
        return orderId != null ? paymentRepository.findByOrderId(orderId) : paymentRepository.findAll();
    }

    public Mono<Payment> findById(Long id) {
        return paymentRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Payment not found: " + id)));
    }

    public Mono<Payment> create(Payment payment) {
        Payment toSave = new Payment(null, payment.orderId(), payment.methodId(), payment.amount(),
                payment.currency() != null ? payment.currency() : "INR",
                payment.status() != null ? payment.status() : "PENDING",
                payment.transactionRef(), payment.paidAt(), null);
        return paymentRepository.save(toSave).flatMap(saved -> paymentRepository.findById(saved.paymentId()));
    }

    public Mono<Payment> update(Long id, Payment payment) {
        return findById(id)
                .map(existing -> new Payment(id, payment.orderId(), payment.methodId(), payment.amount(),
                        payment.currency(), payment.status(), payment.transactionRef(), payment.paidAt(),
                        existing.createdAt()))
                .flatMap(paymentRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(paymentRepository::delete);
    }

    /**
     * Called from the Kafka listener when an OrderCreatedEvent arrives.
     * Simulates a payment gateway call (this demo always approves), writes
     * an audit trail to Payment_Logs, and publishes PaymentCompletedEvent so
     * order-service and delivery-service can react — all asynchronously;
     * nothing here ever calls back to order-service directly.
     */
    public Mono<Payment> processOrderPayment(OrderCreatedEvent event) {
        Payment pending = new Payment(null, event.orderId(), event.paymentMethodId(), event.finalAmount(),
                "INR", "PENDING", null, null, null);

        return paymentRepository.save(pending)
                .flatMap(saved -> logEvent(saved.paymentId(), "INITIATED",
                        "Payment initiated for order " + event.orderId()).thenReturn(saved))
                .flatMap(saved -> {
                    String transactionRef = "TXN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                    Payment approved = new Payment(saved.paymentId(), saved.orderId(), saved.methodId(),
                            saved.amount(), saved.currency(), "SUCCESS", transactionRef,
                            LocalDateTime.now(), saved.createdAt());
                    return paymentRepository.save(approved);
                })
                .flatMap(paid -> logEvent(paid.paymentId(), "SUCCESS", "Payment marked successful").thenReturn(paid))
                .flatMap(paid -> paymentRepository.findById(paid.paymentId()))
                .doOnNext(paid -> paymentEventProducer.publish(new PaymentCompletedEvent(
                        paid.orderId(), paid.paymentId(), event.customerId(), event.restaurantId(),
                        paid.amount(), paid.status(), paid.transactionRef(), event.deliveryAddressText())));
    }

    private Mono<PaymentLog> logEvent(Long paymentId, String eventType, String message) {
        return paymentLogRepository.save(new PaymentLog(null, paymentId, eventType, message, null));
    }
}
