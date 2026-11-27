package com.hospital.common.client;

import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.common.web.ApiException;
import com.hospital.common.web.DownstreamClientException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.common.web.ServiceUnavailableException;

/** Maps an HTTP error answer of a downstream service to the matching ApiException (shared by Feign and WebClient). */
public final class HttpErrors {
    private HttpErrors() {
    }

    public static ApiException map(ObjectMapper mapper, String service, int status, String body) {
        String message = extractMessage(mapper, body);
        if (status == 404) return new ResourceNotFoundException(message != null ? message : service + ": resource not found");
        if (status >= 500) return new ServiceUnavailableException(service + " failed with HTTP " + status + (message != null ? ": " + message : ""));
        HttpStatus hs = HttpStatus.resolve(status);
        return new DownstreamClientException(hs != null ? hs : HttpStatus.BAD_REQUEST, message != null ? message : service + " rejected the request (HTTP " + status + ")");
    }

    private static String extractMessage(ObjectMapper mapper, String body) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonNode n = mapper.readTree(body);
            return n.hasNonNull("message") ? n.get("message").asText() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
