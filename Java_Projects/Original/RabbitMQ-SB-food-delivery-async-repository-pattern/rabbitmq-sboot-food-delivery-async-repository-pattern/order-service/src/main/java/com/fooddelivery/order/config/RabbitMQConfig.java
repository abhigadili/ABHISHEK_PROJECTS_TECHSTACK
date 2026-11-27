package com.fooddelivery.order.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Declares this service's RabbitMQ topology: the 'order-events.exchange' it
 * publishes OrderCreatedEvent to, and the queues+bindings it consumes
 * PaymentCompletedEvent and DeliveryStatusUpdatedEvent from. The exchanges
 * for the topics this service does not own (payment-events, delivery-events)
 * are also declared here so this service's own binding has something to
 * bind to — RabbitAdmin (auto-configured by Spring Boot) creates/verifies
 * all of it on startup, the AMQP equivalent of Spring Kafka's NewTopic beans.
 */
@Configuration
public class RabbitMQConfig {

    /**
     * Without this bean, Spring Boot wires the autoconfigured RabbitTemplate
     * with the plain SimpleMessageConverter, which only accepts String,
     * byte[] or java.io.Serializable payloads and rejects OrderCreatedEvent.
     * This service's two @RabbitListener queues each use their own
     * type-specific converter (see RabbitConsumerConfig), so this bean is
     * only ever exercised for outgoing publish() calls — no defaultType is
     * needed here since a converter never needs to guess the type it's
     * serializing.
     */
    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public TopicExchange orderEventsExchange(@Value("${rabbitmq.exchange.order-events}") String exchangeName) {
        return new TopicExchange(exchangeName);
    }

    @Bean
    public TopicExchange paymentEventsExchange(@Value("${rabbitmq.exchange.payment-events}") String exchangeName) {
        return new TopicExchange(exchangeName);
    }

    @Bean
    public TopicExchange deliveryEventsExchange(@Value("${rabbitmq.exchange.delivery-events}") String exchangeName) {
        return new TopicExchange(exchangeName);
    }

    @Bean
    public Queue paymentEventsQueue(@Value("${rabbitmq.queue.payment-events}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding paymentEventsBinding(Queue paymentEventsQueue, TopicExchange paymentEventsExchange,
                                         @Value("${rabbitmq.routing-key.payment-events}") String routingKey) {
        return BindingBuilder.bind(paymentEventsQueue).to(paymentEventsExchange).with(routingKey);
    }

    @Bean
    public Queue deliveryEventsQueue(@Value("${rabbitmq.queue.delivery-events}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding deliveryEventsBinding(Queue deliveryEventsQueue, TopicExchange deliveryEventsExchange,
                                          @Value("${rabbitmq.routing-key.delivery-events}") String routingKey) {
        return BindingBuilder.bind(deliveryEventsQueue).to(deliveryEventsExchange).with(routingKey);
    }
}
