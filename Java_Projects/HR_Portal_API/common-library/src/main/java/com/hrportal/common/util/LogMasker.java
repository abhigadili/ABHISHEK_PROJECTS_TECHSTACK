package com.hrportal.common.util;

import java.util.regex.Pattern;

/** Masks sensitive values before they are logged or returned (account numbers, tax ids, tokens, passwords). */
public final class LogMasker {
    private static final Pattern SENSITIVE_PARAM = Pattern.compile("(?i)(password|token|secret|authorization|pan|account)=([^&]*)");

    private LogMasker() {
    }

    public static String maskQuery(String query) {
        return query == null ? null : SENSITIVE_PARAM.matcher(query).replaceAll("$1=***");
    }

    /** 1234567890 -> ******7890 */
    public static String maskTail(String value, int visible) {
        if (value == null) return null;
        if (value.length() <= visible) return "*".repeat(value.length());
        return "*".repeat(value.length() - visible) + value.substring(value.length() - visible);
    }

    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return email;
        int at = email.indexOf('@');
        return email.charAt(0) + "***" + email.substring(at);
    }
}
