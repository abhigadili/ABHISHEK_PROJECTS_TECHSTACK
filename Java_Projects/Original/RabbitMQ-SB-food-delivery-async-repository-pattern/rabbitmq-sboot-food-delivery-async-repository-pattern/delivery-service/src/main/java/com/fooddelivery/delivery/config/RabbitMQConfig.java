package com.fooddelivery.delivery.config;

import com.fooddelivery.delivery.event.PaymentCompletedEvent;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.DefaultClassMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Declares this service's RabbitMQ topology: the queue+binding it consumes
 * PaymentCompletedEvent from (on the 'payment-events.exchange' owned by
 * payment-service), and the 'delivery-events.exchange' it publishes
 * DeliveryStatusUpdatedEvent to. RabbitAdmin (auto-configured by Spring
 * Boot) creates/verifies all of it on startup — the AMQP equivalent of
 * Spring Kafka's NewTopic beans.
 */
@Configuration
public class RabbitMQConfig {

    @Bean
    public TopicExchange paymentEventsExchange(@Value("${rabbitmq.exchange.payment-events}") String exchangeName) {
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
    public TopicExchange deliveryEventsExchange(@Value("${rabbitmq.exchange.delivery-events}") String exchangeName) {
        return new TopicExchange(exchangeName);
    }

    /**
     * payment-service and delivery-service each define their OWN local
     * PaymentCompletedEvent class in different packages — see
     * payment-service's RabbitMQConfig for the full explanation of why
     * alwaysConvertToInferredType is needed to ignore the producer's
     * __TypeId__ header. This service only ever consumes one event shape,
     * so a single converter bean (used automatically for both the
     * RabbitTemplate and the default listener container factory) is enough.
     */
    @Bean
    public MessageConverter messageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        converter.setAlwaysConvertToInferredType(true);
        DefaultClassMapper classMapper = new DefaultClassMapper();
        classMapper.setDefaultType(PaymentCompletedEvent.class);
        converter.setClassMapper(classMapper);
        return converter;
    }
}
