package com.fooddelivery.common.security;

/** Role names (stored without the ROLE_ prefix in the token). */
public final class Roles {
    public static final String CUSTOMER = "CUSTOMER";
    public static final String RESTAURANT_OWNER = "RESTAURANT_OWNER";
    public static final String RESTAURANT_STAFF = "RESTAURANT_STAFF";
    public static final String DELIVERY_PARTNER = "DELIVERY_PARTNER";
    public static final String ADMIN = "ADMIN";
    public static final String SUPER_ADMIN = "SUPER_ADMIN";
    /** Internal machine-to-machine role carried by service tokens. */
    public static final String SERVICE = "SERVICE";

    private Roles() {}
}
