package com.fooddelivery.payment.config;

import com.fooddelivery.payment.event.OrderCreatedEvent;
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
 * OrderCreatedEvent from (on the 'order-events.exchange' owned by
 * order-service), and the 'payment-events.exchange' it publishes
 * PaymentCompletedEvent to. RabbitAdmin (auto-configured by Spring Boot)
 * creates/verifies all of it on startup — the AMQP equivalent of Spring
 * Kafka's NewTopic beans.
 */
@Configuration
public class RabbitMQConfig {

    @Bean
    public TopicExchange orderEventsExchange(@Value("${rabbitmq.exchange.order-events}") String exchangeName) {
        return new TopicExchange(exchangeName);
    }

    @Bean
    public Queue orderEventsQueue(@Value("${rabbitmq.queue.order-events}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding orderEventsBinding(Queue orderEventsQueue, TopicExchange orderEventsExchange,
                                       @Value("${rabbitmq.routing-key.order-events}") String routingKey) {
        return BindingBuilder.bind(orderEventsQueue).to(orderEventsExchange).with(routingKey);
    }

    @Bean
    public TopicExchange paymentEventsExchange(@Value("${rabbitmq.exchange.payment-events}") String exchangeName) {
        return new TopicExchange(exchangeName);
    }

    /**
     * order-service and payment-service each define their OWN local
     * OrderCreatedEvent class in different packages. Jackson2JsonMessageConverter
     * still stamps outgoing messages with a __TypeId__ header naming the
     * PRODUCER's class, which this consumer can neither trust (different
     * package) nor load (different service, different classpath) — so
     * alwaysConvertToInferredType tells this converter to ignore that header
     * entirely and always deserialize into whatever type the target
     * @RabbitListener method declares (OrderCreatedEvent here). defaultType
     * is kept as a fallback for the rare case Spring can't infer a type.
     * This single bean is picked up automatically by both the autoconfigured
     * RabbitTemplate (producer) and the autoconfigured listener container
     * factory (consumer), since this service only ever consumes one event
     * shape.
     */
    @Bean
    public MessageConverter messageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        converter.setAlwaysConvertToInferredType(true);
        DefaultClassMapper classMapper = new DefaultClassMapper();
        classMapper.setDefaultType(OrderCreatedEvent.class);
        converter.setClassMapper(classMapper);
        return converter;
    }
}
