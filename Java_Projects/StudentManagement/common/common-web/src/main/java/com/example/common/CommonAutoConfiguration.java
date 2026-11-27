package com.example.common;

import com.example.common.exception.GlobalExceptionHandler;
import com.example.common.security.JwtAuthenticationFilter;
import com.example.common.security.JwtProperties;
import com.example.common.security.JwtTokenService;
import com.example.common.web.CorrelationIdFilter;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@AutoConfiguration
@EnableConfigurationProperties(JwtProperties.class)
public class CommonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public JwtTokenService jwtTokenService(JwtProperties props) { return new JwtTokenService(props); }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    static class ServletConfig {
        @Bean
        FilterRegistrationBean<CorrelationIdFilter> correlationIdFilter() {
            var reg = new FilterRegistrationBean<>(new CorrelationIdFilter());
            // just after Spring's observation filter (HIGHEST_PRECEDENCE + 1): traceId/spanId are already in the MDC when we log
            reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
            return reg;
        }

        /** Not auto-registered as a servlet filter: added to the Spring Security chain by each service. */
        @Bean
        JwtAuthenticationFilter jwtAuthenticationFilter(JwtTokenService tokens) { return new JwtAuthenticationFilter(tokens); }

        @Bean
        FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistrationDisabled(JwtAuthenticationFilter f) {
            var reg = new FilterRegistrationBean<>(f);
            reg.setEnabled(false);
            return reg;
        }

        @Bean
        GlobalExceptionHandler globalExceptionHandler() { return new GlobalExceptionHandler(); }
    }

    /** Swagger/OpenAPI: documents the JWT bearer scheme so "Authorize" works in Swagger UI. */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(OpenAPI.class)
    static class OpenApiConfig {
        @Bean
        @ConditionalOnMissingBean
        OpenAPI openApi(@Value("${spring.application.name:service}") String name) {
            return new OpenAPI()
                    .info(new Info().title(name + " API").version("1.0.0")
                            .description("Student Management System - " + name + ". All calls go through the API Gateway (:8080)."))
                    .components(new Components().addSecuritySchemes("bearerAuth",
                            new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                    .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
        }
    }
}
