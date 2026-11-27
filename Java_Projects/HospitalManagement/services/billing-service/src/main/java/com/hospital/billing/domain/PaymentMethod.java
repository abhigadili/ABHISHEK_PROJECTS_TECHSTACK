package com.hospital.billing.domain;

/** Only the method is recorded - card numbers / CVV / UPI PINs are never accepted or stored. */
public enum PaymentMethod { CARD, UPI, NET_BANKING, CASH, INSURANCE }
