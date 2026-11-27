package com.fooddelivery.payment.provider;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/** Picks the provider named by {@code food.payment.provider}; refuses to start rather than silently faking an unknown one. */
@Component
public class ProviderRegistry {
    private final PaymentProvider active;

    public ProviderRegistry(List<PaymentProvider> providers, @Value("${food.payment.provider:sandbox}") String wanted) {
        this.active = providers.stream().filter(p -> p.name().equalsIgnoreCase(wanted)).findFirst().orElseThrow(() ->
                new IllegalStateException("No PaymentProvider named '" + wanted + "' is configured. Available: "
                        + providers.stream().map(PaymentProvider::name).toList() + ". Real providers must be implemented explicitly."));
    }

    public PaymentProvider active() { return active; }
}
