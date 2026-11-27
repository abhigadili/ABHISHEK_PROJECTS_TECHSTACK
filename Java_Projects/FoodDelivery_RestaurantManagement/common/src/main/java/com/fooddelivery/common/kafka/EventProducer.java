package com.fooddelivery.common.kafka;

import java.lang.annotation.*;

/** Marks a producer class and the topics it publishes; read at startup to build the real producer->topic map. */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface EventProducer {
    String[] topics();
}
