package com.fooddelivery.common.config;

import com.fooddelivery.common.web.ServiceInfoServlet;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.ServletListenerRegistrationBean;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Registers the plain servlet and a ServletContextListener with the embedded Tomcat. */
@Configuration
public class ServletConfig {
    private static final Logger log = LoggerFactory.getLogger(ServletConfig.class);

    @Bean
    public ServletRegistrationBean<ServiceInfoServlet> serviceInfoServlet(@Value("${spring.application.name}") String name) {
        ServletRegistrationBean<ServiceInfoServlet> reg = new ServletRegistrationBean<>(new ServiceInfoServlet(), "/servlet/info");
        reg.addInitParameter("service-name", name);
        reg.setLoadOnStartup(1);
        return reg;
    }

    /** Servlet listener: container-level lifecycle events (startup/shutdown of the web application). */
    @Bean
    public ServletListenerRegistrationBean<ServletContextListener> contextLifecycleListener() {
        return new ServletListenerRegistrationBean<>(new ServletContextListener() {
            @Override public void contextInitialized(ServletContextEvent e) {
                log.info("ServletContext initialised: {}", e.getServletContext().getServerInfo());
            }
            @Override public void contextDestroyed(ServletContextEvent e) {
                log.info("ServletContext destroyed");
            }
        });
    }
}
