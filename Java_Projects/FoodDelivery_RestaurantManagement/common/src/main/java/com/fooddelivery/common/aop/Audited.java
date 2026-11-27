package com.fooddelivery.common.aop;

import java.lang.annotation.*;

/** Marks a service method whose invocation must be written to the audit log (who, what, how long, outcome). */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    String value();
}
