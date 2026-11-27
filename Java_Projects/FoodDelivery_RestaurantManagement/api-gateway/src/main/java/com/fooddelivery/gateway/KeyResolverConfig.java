package com.fooddelivery.gateway;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Mono;

import java.util.Base64;

/** Rate-limit key: the bearer token's subject-ish hash when logged in, otherwise the client IP. */
@Configuration
public class KeyResolverConfig {
    @Bean
    public KeyResolver clientKeyResolver() {
        return exchange -> {
            String auth = exchange.getRequest().getHeaders().getFirst("Authorization");
            if (auth != null && auth.startsWith("Bearer ") && auth.length() > 30) {
                // token signature tail is unique per token; avoids parsing here (parsing happens in JwtGlobalFilter)
                return Mono.just("tok:" + auth.substring(auth.length() - 24));
            }
            var addr = exchange.getRequest().getRemoteAddress();
            return Mono.just("ip:" + (addr == null ? "unknown" : addr.getAddress().getHostAddress()));
        };
    }
}
