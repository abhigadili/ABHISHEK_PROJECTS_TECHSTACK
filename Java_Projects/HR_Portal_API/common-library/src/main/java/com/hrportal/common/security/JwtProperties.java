package com.hrportal.common.security;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Getter;
import lombok.Setter;

/** Bound from {@code hr.security.*}; the secret always comes from the JWT_SECRET environment variable. */
@Getter
@Setter
@ConfigurationProperties("hr.security")
public class JwtProperties {
    private Jwt jwt = new Jwt();
    /** Extra anonymous paths for a service (login etc.). */
    private List<String> publicPaths = new ArrayList<>();

    @Getter
    @Setter
    public static class Jwt {
        private String secret;
        private long accessTokenMinutes = 30;
        private long refreshTokenDays = 7;
        private String issuer = "hr-portal";
    }
}
