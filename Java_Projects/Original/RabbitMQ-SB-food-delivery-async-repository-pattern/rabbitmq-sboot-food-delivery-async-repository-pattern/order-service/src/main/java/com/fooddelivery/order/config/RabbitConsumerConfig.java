package com.fooddelivery.order.config;

import com.fooddelivery.order.event.DeliveryStatusUpdatedEvent;
import com.fooddelivery.order.event.PaymentCompletedEvent;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.DefaultClassMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * order-service is the only service in this system that consumes two
 * different event shapes (PaymentCompletedEvent from the payment-events
 * queue, DeliveryStatusUpdatedEvent from the delivery-events queue). Spring
 * Boot's single autoconfigured listener container factory can only be told
 * one default JSON target type, so this service defines two container
 * factories instead — one per event shape — each wired to its own
 * @RabbitListener via containerFactory=.
 */
@Configuration
public class RabbitConsumerConfig {

    @Bean
    public SimpleRabbitListenerContainerFactory paymentEventsContainerFactory(ConnectionFactory connectionFactory) {
        return buildContainerFactory(connectionFactory, PaymentCompletedEvent.class);
    }

    @Bean
    public SimpleRabbitListenerContainerFactory deliveryEventsContainerFactory(ConnectionFactory connectionFactory) {
        return buildContainerFactory(connectionFactory, DeliveryStatusUpdatedEvent.class);
    }

    private SimpleRabbitListenerContainerFactory buildContainerFactory(ConnectionFactory connectionFactory, Class<?> targetType) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(buildMessageConverter(targetType));
        return factory;
    }

    /**
     * PaymentCompletedEvent/DeliveryStatusUpdatedEvent are published by
     * payment-service/delivery-service's OWN local copies of these classes,
     * in different packages than this service's copies. The producer's
     * Jackson2JsonMessageConverter still stamps a __TypeId__ header with
     * ITS class name, which this consumer can neither trust (different
     * package) nor load (different service, different classpath) — so
     * alwaysConvertToInferredType tells this converter to ignore that
     * header entirely and always deserialize into whatever type the
     * target @RabbitListener method declares. defaultType is kept as a
     * fallback for the rare case Spring can't infer a type from the method.
     */
    private Jackson2JsonMessageConverter buildMessageConverter(Class<?> targetType) {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        converter.setAlwaysConvertToInferredType(true);
        DefaultClassMapper classMapper = new DefaultClassMapper();
        classMapper.setDefaultType(targetType);
        converter.setClassMapper(classMapper);
        return converter;
    }
}
