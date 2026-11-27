package com.hrportal.common.cache;

/** Cache-key design helpers: keys are readable, lower-case and always include the owning id. */
public final class CacheKeys {
    private CacheKeys() {
    }

    public static String of(Object... parts) {
        StringBuilder sb = new StringBuilder();
        for (Object p : parts) {
            if (sb.length() > 0) sb.append(':');
            sb.append(p == null ? "all" : String.valueOf(p).toLowerCase());
        }
        return sb.toString();
    }
}
