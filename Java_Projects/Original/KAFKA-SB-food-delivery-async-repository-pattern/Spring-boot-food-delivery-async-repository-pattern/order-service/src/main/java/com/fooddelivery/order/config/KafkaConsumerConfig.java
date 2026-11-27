package com.fooddelivery.order.config;

import com.fooddelivery.order.event.DeliveryStatusUpdatedEvent;
import com.fooddelivery.order.event.PaymentCompletedEvent;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonDeserializer;

import java.util.HashMap;
import java.util.Map;

/**
 * order-service is the only service in this system that consumes two
 * different event shapes (PaymentCompletedEvent from 'payment-events',
 * DeliveryStatusUpdatedEvent from 'delivery-events'). Spring Boot's single
 * autoconfigured consumer factory can only be told one default JSON target
 * type, so this service defines two consumer factories instead — one per
 * event shape — each wired to its own @KafkaListener via containerFactory=.
 */
@Configuration
public class KafkaConsumerConfig {

    private final KafkaProperties kafkaProperties;

    public KafkaConsumerConfig(KafkaProperties kafkaProperties) {
        this.kafkaProperties = kafkaProperties;
    }

    @Bean
    public ConsumerFactory<String, Object> paymentEventsConsumerFactory() {
        return buildConsumerFactory(PaymentCompletedEvent.class);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> paymentEventsContainerFactory(
            ConsumerFactory<String, Object> paymentEventsConsumerFactory) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(paymentEventsConsumerFactory);
        return factory;
    }

    @Bean
    public ConsumerFactory<String, Object> deliveryEventsConsumerFactory() {
        return buildConsumerFactory(DeliveryStatusUpdatedEvent.class);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> deliveryEventsContainerFactory(
            ConsumerFactory<String, Object> deliveryEventsConsumerFactory) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(deliveryEventsConsumerFactory);
        return factory;
    }

    private ConsumerFactory<String, Object> buildConsumerFactory(Class<?> targetType) {
        Map<String, Object> props = new HashMap<>(kafkaProperties.buildConsumerProperties());
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, targetType.getName());
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "com.fooddelivery.order.event");
        return new DefaultKafkaConsumerFactory<>(props);
    }
}
