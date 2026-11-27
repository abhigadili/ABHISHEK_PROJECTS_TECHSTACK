package com.hrportal.common.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class ServletRegistrationConfig {

    @Bean
    public ServletRegistrationBean<ServiceInfoServlet> serviceInfoServlet(@Value("${spring.application.name}") String service) {
        ServletRegistrationBean<ServiceInfoServlet> bean = new ServletRegistrationBean<>(new ServiceInfoServlet(service), "/servlet/info");
        bean.setLoadOnStartup(2);
        return bean;
    }
}
