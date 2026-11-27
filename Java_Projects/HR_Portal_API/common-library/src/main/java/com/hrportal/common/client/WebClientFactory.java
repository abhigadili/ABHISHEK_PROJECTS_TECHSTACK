package com.hrportal.common.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Creates {@link HrWebClient}s with the shared timeouts (hr.webclient.*). */
@Component
public class WebClientFactory {
    private final int connectMs;
    private final int responseMs;

    public WebClientFactory(@Value("${hr.webclient.connect-timeout-ms:2000}") int connectMs,
                            @Value("${hr.webclient.response-timeout-ms:5000}") int responseMs) {
        this.connectMs = connectMs;
        this.responseMs = responseMs;
    }

    public HrWebClient create(String baseUrl) {
        return new HrWebClient(baseUrl, connectMs, responseMs);
    }
}
