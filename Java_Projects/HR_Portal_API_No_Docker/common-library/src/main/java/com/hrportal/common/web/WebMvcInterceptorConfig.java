package com.hrportal.common.web;

import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registers the interceptors on the DispatcherServlet pipeline (after HandlerMapping, before the controller). */
@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class WebMvcInterceptorConfig implements WebMvcConfigurer {
    private final RequestMetadataInterceptor metadata;
    private final UserContextInterceptor userContext;
    private final RequestTimingInterceptor timing;

    public WebMvcInterceptorConfig(RequestMetadataInterceptor metadata, UserContextInterceptor userContext, RequestTimingInterceptor timing) {
        this.metadata = metadata;
        this.userContext = userContext;
        this.timing = timing;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(timing).addPathPatterns("/api/**").order(1);
        registry.addInterceptor(metadata).addPathPatterns("/api/**").order(2);
        registry.addInterceptor(userContext).addPathPatterns("/api/**").order(3);
    }
}
