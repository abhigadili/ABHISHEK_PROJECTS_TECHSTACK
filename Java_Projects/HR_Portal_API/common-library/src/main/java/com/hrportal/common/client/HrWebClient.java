package com.hrportal.common.client;

import java.time.Duration;
import java.util.Optional;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.DownstreamClientException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.exception.UnauthorizedException;
import com.hrportal.common.security.CurrentUser;

import io.netty.channel.ChannelOption;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.util.retry.Retry;

/**
 * Thin, reusable non-blocking client over Spring WebFlux {@link WebClient}.
 * Every call: captures the caller's JWT + correlation id UP FRONT (on the calling thread - reactive operators may
 * run on other threads where the thread-locals are gone), applies a timeout, retries transient failures with
 * back-off (GET only) and maps downstream HTTP errors to the project's exception types.
 * Demonstrates GET / POST / PUT / PATCH / DELETE, retrieve(), exchangeToMono(), timeout(), retryWhen(),
 * onErrorResume() and onErrorReturn().
 */
public class HrWebClient {
    private static final Logger log = LoggerFactory.getLogger(HrWebClient.class);
    private final WebClient client;
    private final Duration timeout;

    public HrWebClient(String baseUrl, int connectTimeoutMs, int responseTimeoutMs) {
        HttpClient http = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, connectTimeoutMs)
                .responseTimeout(Duration.ofMillis(responseTimeoutMs));
        this.client = WebClient.builder().baseUrl(baseUrl).clientConnector(new ReactorClientHttpConnector(http)).build();
        this.timeout = Duration.ofMillis(responseTimeoutMs + 1000L);
    }

    /**
     * A view of this client bound to a token / correlation id captured EARLIER on the request thread. Use it for calls that are created
     * inside reactive operators (flatMap ...), which run on Netty threads where the SecurityContext thread-local no longer exists.
     */
    public Bound as(String token, String correlationId) {
        return new Bound(token, correlationId);
    }

    public final class Bound {
        private final String token;
        private final String correlationId;

        private Bound(String token, String correlationId) {
            this.token = token;
            this.correlationId = correlationId;
        }

        private Consumer<HttpHeaders> headers() {
            return h -> {
                if (token != null) h.setBearerAuth(token);
                if (correlationId != null) h.set("X-Correlation-Id", correlationId);
            };
        }

        public <T> Mono<T> get(String uri, Class<T> type, Object... vars) {
            return client.get().uri(uri, vars).headers(headers()).retrieve().onStatus(HttpStatusCode::isError, HrWebClient.this::mapError).bodyToMono(type).timeout(timeout);
        }

        public <T> Mono<T> get(String uri, ParameterizedTypeReference<T> type, Object... vars) {
            return client.get().uri(uri, vars).headers(headers()).retrieve().onStatus(HttpStatusCode::isError, HrWebClient.this::mapError).bodyToMono(type).timeout(timeout);
        }
    }

    private Consumer<HttpHeaders> headers() {
        String token = CurrentUser.token();
        String cid = MDC.get("correlationId");
        return h -> {
            if (token != null) h.setBearerAuth(token);
            if (cid != null) h.set("X-Correlation-Id", cid);
        };
    }

    public <T> Mono<T> get(String uri, Class<T> type, Object... vars) {
        return client.get().uri(uri, vars).headers(headers()).retrieve()
                .onStatus(HttpStatusCode::isError, this::mapError)
                .bodyToMono(type).timeout(timeout)
                .retryWhen(Retry.backoff(2, Duration.ofMillis(200)).filter(HrWebClient::transientFailure)
                        .onRetryExhaustedThrow((spec, signal) -> new ServiceUnavailableException("Downstream service unavailable")));
    }

    public <T> Mono<T> get(String uri, ParameterizedTypeReference<T> type, Object... vars) {
        return client.get().uri(uri, vars).headers(headers()).retrieve()
                .onStatus(HttpStatusCode::isError, this::mapError)
                .bodyToMono(type).timeout(timeout)
                .retryWhen(Retry.backoff(2, Duration.ofMillis(200)).filter(HrWebClient::transientFailure)
                        .onRetryExhaustedThrow((spec, signal) -> new ServiceUnavailableException("Downstream service unavailable")));
    }

    /** exchangeToMono(): inspect the status ourselves - a 404 becomes Optional.empty() instead of an error. */
    public <T> Mono<Optional<T>> getOptional(String uri, Class<T> type, Object... vars) {
        return client.get().uri(uri, vars).headers(headers())
                .exchangeToMono(resp -> {
                    if (resp.statusCode().value() == 404) return resp.releaseBody().thenReturn(Optional.<T>empty());
                    if (resp.statusCode().isError()) return mapError(resp).flatMap(Mono::error);
                    return resp.bodyToMono(type).map(Optional::of);
                }).timeout(timeout);
    }

    /** onErrorReturn(): best-effort section of an aggregate - a failure yields the fallback value. */
    public <T> Mono<T> getOrDefault(String uri, Class<T> type, T fallback, Object... vars) {
        return get(uri, type, vars).onErrorReturn(fallback);
    }

    /** onErrorResume(): log and degrade to an empty result. */
    public <T> Mono<T> getOrEmpty(String uri, Class<T> type, Object... vars) {
        return get(uri, type, vars).onErrorResume(e -> {
            log.warn("Optional downstream call {} failed: {}", uri, e.toString());
            return Mono.empty();
        });
    }

    public <T> Mono<T> post(String uri, Object body, Class<T> type, Object... vars) {
        return send(HttpMethod.POST, uri, body, type, vars);
    }

    public <T> Mono<T> put(String uri, Object body, Class<T> type, Object... vars) {
        return send(HttpMethod.PUT, uri, body, type, vars);
    }

    public <T> Mono<T> patch(String uri, Object body, Class<T> type, Object... vars) {
        return send(HttpMethod.PATCH, uri, body, type, vars);
    }

    public Mono<Void> delete(String uri, Object... vars) {
        return client.delete().uri(uri, vars).headers(headers()).retrieve()
                .onStatus(HttpStatusCode::isError, this::mapError).bodyToMono(Void.class).timeout(timeout);
    }

    private <T> Mono<T> send(HttpMethod method, String uri, Object body, Class<T> type, Object... vars) {
        WebClient.RequestBodySpec spec = client.method(method).uri(uri, vars).headers(headers());
        WebClient.RequestHeadersSpec<?> req = body == null ? spec : spec.bodyValue(body);
        return req.retrieve().onStatus(HttpStatusCode::isError, this::mapError).bodyToMono(type).timeout(timeout);
    }

    private Mono<? extends Throwable> mapError(ClientResponse resp) {
        return resp.bodyToMono(String.class).defaultIfEmpty("").map(body -> {
            String msg = extractMessage(body, resp.statusCode().value());
            HttpStatus s = HttpStatus.resolve(resp.statusCode().value());
            if (s == null) return new ServiceUnavailableException(msg);
            return switch (s) {
                case NOT_FOUND -> new ResourceNotFoundException(msg);
                case BAD_REQUEST, UNPROCESSABLE_ENTITY -> new BadRequestException(msg);
                case CONFLICT -> new ConflictException(msg);
                case UNAUTHORIZED -> new UnauthorizedException(msg);
                case FORBIDDEN -> new ForbiddenOperationException(msg);
                default -> s.is4xxClientError() ? new DownstreamClientException(s, msg) : new ServiceUnavailableException(msg);
            };
        });
    }

    private static String extractMessage(String body, int status) {
        int i = body.indexOf("\"message\":\"");
        if (i >= 0) {
            int start = i + 11;
            int end = body.indexOf('"', start);
            if (end > start) return body.substring(start, end);
        }
        return "Downstream returned " + status;
    }

    private static boolean transientFailure(Throwable t) {
        return t instanceof java.util.concurrent.TimeoutException || t instanceof java.net.ConnectException
                || (t.getCause() instanceof java.net.ConnectException)
                || (t instanceof WebClientResponseException w && w.getStatusCode().is5xxServerError());
    }
}
