package com.hrportal.common.web;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.time.Instant;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * A plain {@link HttpServlet} (outside Spring MVC) - shows the raw Servlet API: it is mapped by
 * {@link ServletRegistrationConfig} next to the DispatcherServlet and answers build / runtime information.
 */
public class ServiceInfoServlet extends HttpServlet {
    private final String service;
    private final Instant startedAt = Instant.now();

    public ServiceInfoServlet(String service) {
        this.service = service;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        long uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
        resp.getWriter().write("{\"service\":\"" + service + "\",\"java\":\"" + System.getProperty("java.version")
                + "\",\"startedAt\":\"" + startedAt + "\",\"uptimeSeconds\":" + uptimeSeconds
                + ",\"servletApi\":\"" + getServletContext().getMajorVersion() + "." + getServletContext().getMinorVersion() + "\"}");
    }
}
