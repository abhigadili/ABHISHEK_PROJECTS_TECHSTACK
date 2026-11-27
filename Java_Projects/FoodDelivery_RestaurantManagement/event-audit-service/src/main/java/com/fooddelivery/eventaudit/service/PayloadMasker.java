package com.fooddelivery.eventaudit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Iterator;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Redacts sensitive data BEFORE anything is persisted by the audit store:
 * secrets/tokens/card fields -> "***", e-mail -> j***@host, phone -> ****1234, and the free-text message of password-reset
 * notifications (it contains a one-time code). The result is size-capped.
 */
@Component
public class PayloadMasker {
    private static final Pattern SECRET_KEY = Pattern.compile("(?i).*(password|secret|token|authorization|card|cvv|pin|otp|credential).*");
    private static final Pattern EMAIL = Pattern.compile("^([^@])[^@]*@(.+)$");
    private final ObjectMapper mapper;
    private final int maxChars;

    public PayloadMasker(ObjectMapper mapper, @Value("${food.audit.max-payload-chars:6000}") int maxChars) {
        this.mapper = mapper;
        this.maxChars = maxChars;
    }

    public String mask(JsonNode payload, String eventType) {
        if (payload == null || payload.isNull()) return null;
        JsonNode copy = payload.deepCopy();
        redact(copy, "PasswordResetRequested".equals(eventType));
        String s = copy.toString();
        return s.length() > maxChars ? s.substring(0, maxChars) + "...[truncated]" : s;
    }

    private void redact(JsonNode node, boolean redactMessage) {
        if (node instanceof ObjectNode o) {
            Iterator<Map.Entry<String, JsonNode>> it = o.fields();
            while (it.hasNext()) {
                var e = it.next();
                String k = e.getKey();
                JsonNode v = e.getValue();
                if (v.isTextual() && (SECRET_KEY.matcher(k).matches() || (redactMessage && k.equals("message")))) o.put(k, "***");
                else if (v.isTextual() && k.toLowerCase().contains("email")) o.put(k, EMAIL.matcher(v.asText()).replaceFirst("$1***@$2"));
                else if (v.isTextual() && k.toLowerCase().contains("phone")) { String t = v.asText(); o.put(k, t.length() > 4 ? "*".repeat(t.length() - 4) + t.substring(t.length() - 4) : "****"); }
                else redact(v, redactMessage);
            }
        } else if (node instanceof ArrayNode a) {
            a.forEach(x -> redact(x, redactMessage));
        }
    }

    public ObjectMapper mapper() { return mapper; }
}
