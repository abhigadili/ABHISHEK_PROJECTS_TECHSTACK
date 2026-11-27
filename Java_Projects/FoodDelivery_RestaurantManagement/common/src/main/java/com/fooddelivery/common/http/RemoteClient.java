package com.fooddelivery.common.http;

import com.fooddelivery.common.exception.RemoteServiceException;
import com.fooddelivery.common.web.Correlation;
import io.netty.channel.ChannelOption;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.loadbalancer.reactive.ReactorLoadBalancerExchangeFilterFunction;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service-to-service WebClient, load balanced through Eureka ("http://order-service/...").
 * <ul>
 *   <li>Timeouts: connect 2 s, response 5 s (Reactor Netty).</li>
 *   <li>Exchange filters: request/response logging, correlation id, error mapping to {@link RemoteServiceException}.</li>
 *   <li>Retry: only GET (idempotent) and only on connection/5xx failures; POST/PUT/PATCH/DELETE are never retried.</li>
 *   <li>Auth: the Authorization header is resolved <em>eagerly</em> on the calling thread (that is where the servlet
 *       request lives) and attached to the request.</li>
 * </ul>
 * Methods return {@link Mono} so callers can compose calls non-blockingly (e.g. {@code Mono.zip}); servlet-based
 * services block exactly once at the service boundary.
 */
@Component
public class RemoteClient {
    private static final Logger log = LoggerFactory.getLogger(RemoteClient.class);
    private final WebClient.Builder builder;
    private final ReactorLoadBalancerExchangeFilterFunction lb;
    private final AuthPropagation auth;
    private final Map<String, WebClient> clients = new ConcurrentHashMap<>();

    public RemoteClient(WebClient.Builder builder, ReactorLoadBalancerExchangeFilterFunction lb, AuthPropagation auth) {
        this.builder = builder;
        this.lb = lb;
        this.auth = auth;
    }

    private WebClient client(String service) {
        return clients.computeIfAbsent(service, s -> builder.clone()
                .baseUrl("http://" + s)
                .clientConnector(new ReactorClientHttpConnector(HttpClient.create()
                        .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 2000)
                        .responseTimeout(Duration.ofSeconds(5))))
                .filter(lb)
                .filter(logAndMap(s))
                .build());
    }

    private ExchangeFilterFunction logAndMap(String service) {
        return (request, next) -> {
            long start = System.nanoTime();
            return next.exchange(request).flatMap(resp -> {
                long ms = (System.nanoTime() - start) / 1_000_000;
                log.info("WebClient {} {} -> {} ({} ms)", request.method(), request.url(), resp.statusCode().value(), ms);
                if (resp.statusCode().isError()) return mapError(service, resp);
                return Mono.just(resp);
            });
        };
    }

    private Mono<ClientResponse> mapError(String service, ClientResponse resp) {
        HttpStatusCode code = resp.statusCode();
        return resp.bodyToMono(String.class).defaultIfEmpty("").flatMap(body -> {
            String msg = body.contains("\"message\"") ? body.replaceAll("(?s).*\"message\"\\s*:\\s*\"([^\"]*)\".*", "$1") : "Remote call failed";
            return Mono.error(new RemoteServiceException(service, code.value(), msg));
        });
    }

    private WebClient.RequestBodySpec spec(String service, HttpMethod method, String path, Object... vars) {
        return client(service).method(method).uri(path, vars)
                .header("Authorization", auth.authorizationHeader())
                .header(Correlation.HEADER, Correlation.currentOrNew());
    }

    private static boolean retryable(Throwable t) {
        return !(t instanceof RemoteServiceException r) || r.getStatus() >= 500;
    }

    public <T> Mono<T> get(String service, String path, Class<T> type, Object... vars) {
        return spec(service, HttpMethod.GET, path, vars).retrieve().bodyToMono(type)
                .retryWhen(Retry.backoff(2, Duration.ofMillis(200)).filter(RemoteClient::retryable)
                        .onRetryExhaustedThrow((s, sig) -> sig.failure()));
    }

    public <T> Mono<T> get(String service, String path, ParameterizedTypeReference<T> type, Object... vars) {
        return spec(service, HttpMethod.GET, path, vars).retrieve().bodyToMono(type)
                .retryWhen(Retry.backoff(2, Duration.ofMillis(200)).filter(RemoteClient::retryable)
                        .onRetryExhaustedThrow((s, sig) -> sig.failure()));
    }

    public <T> Mono<T> post(String service, String path, Object body, Class<T> type, Object... vars) {
        return send(HttpMethod.POST, service, path, body, type, vars);
    }

    public <T> Mono<T> put(String service, String path, Object body, Class<T> type, Object... vars) {
        return send(HttpMethod.PUT, service, path, body, type, vars);
    }

    public <T> Mono<T> patch(String service, String path, Object body, Class<T> type, Object... vars) {
        return send(HttpMethod.PATCH, service, path, body, type, vars);
    }

    public Mono<Void> delete(String service, String path, Object... vars) {
        return spec(service, HttpMethod.DELETE, path, vars).retrieve().bodyToMono(Void.class);
    }

    private <T> Mono<T> send(HttpMethod m, String service, String path, Object body, Class<T> type, Object... vars) {
        WebClient.RequestBodySpec s = spec(service, m, path, vars);
        WebClient.RequestHeadersSpec<?> h = body == null ? s : s.bodyValue(body);
        return h.retrieve().bodyToMono(type);    // no retry: not idempotent
    }
}
