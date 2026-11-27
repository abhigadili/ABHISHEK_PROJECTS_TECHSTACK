package com.fooddelivery.user.domain;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Fine-grained permissions carried in the token as authorities "PERM_xxx" (used with @PreAuthorize("hasAuthority(...)")). */
public enum Permission {
    USER_MANAGE, RESTAURANT_APPROVE, COUPON_MANAGE, REVIEW_MODERATE, REFUND_MANAGE, KAFKA_MONITOR, KAFKA_REPLAY,
    LOG_VIEW, ADMIN_CREATE, SYSTEM_CONFIG;

    /** Role -> permissions. ADMIN gets operational rights; SUPER_ADMIN additionally creates admins and replays events. */
    public static Set<Permission> forRoles(Set<Role> roles) {
        Set<Permission> p = EnumSet.noneOf(Permission.class);
        if (roles.contains(Role.ADMIN)) p.addAll(List.of(USER_MANAGE, RESTAURANT_APPROVE, COUPON_MANAGE, REVIEW_MODERATE,
                REFUND_MANAGE, KAFKA_MONITOR, LOG_VIEW));
        if (roles.contains(Role.SUPER_ADMIN)) p.addAll(EnumSet.allOf(Permission.class));
        return p;
    }

    public static List<String> names(Set<Role> roles) {
        return forRoles(roles).stream().map(Enum::name).collect(Collectors.toList());
    }
}
