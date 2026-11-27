package com.hospital.billing.service;

import org.springframework.stereotype.Component;

import com.hospital.billing.domain.PaymentMethod;

/**
 * Stand-in for a real payment gateway (no gateway is configured). It never sees card data: it only decides
 * the outcome. CASH and INSURANCE are settled by staff, so they are never auto-settled.
 */
@Component
public class PaymentGatewaySimulator {
    public enum Result { SUCCESS, FAILURE, UNDECIDED }

    public Result authorise(PaymentMethod method, com.hospital.billing.dto.BillingDtos.Outcome forced) {
        if (forced != null) return forced == com.hospital.billing.dto.BillingDtos.Outcome.SUCCESS ? Result.SUCCESS : Result.FAILURE;
        return Result.UNDECIDED;
    }
}
