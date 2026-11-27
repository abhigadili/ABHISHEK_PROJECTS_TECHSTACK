package com.hrportal.common.async;

import java.util.Map;
import java.util.concurrent.RejectedExecutionHandler;
import java.util.concurrent.ThreadPoolExecutor;

import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * One bounded, named thread pool per service for CompletableFuture orchestration (never a thread per request).
 * Sizing: the work is I/O bound (HTTP calls), so core = 2 x CPUs (min 4) and the queue absorbs bursts; when queue
 * and pool are full the CALLER runs the task (back-pressure instead of an unbounded thread count).
 * The decorator copies the logging MDC and the SecurityContext to the worker thread, so the correlation id and the
 * caller's JWT (needed by Feign / WebClient header propagation) are still available there.
 */
@Configuration
public class AsyncConfig {

    @Bean
    public TaskDecorator contextPropagatingDecorator() {
        return runnable -> {
            Map<String, String> mdc = MDC.getCopyOfContextMap();
            SecurityContext ctx = SecurityContextHolder.getContext();
            return () -> {
                Map<String, String> previous = MDC.getCopyOfContextMap();
                SecurityContext prevCtx = SecurityContextHolder.getContext();
                try {
                    if (mdc != null) MDC.setContextMap(mdc);
                    SecurityContextHolder.setContext(ctx);
                    runnable.run();
                } finally {
                    if (previous != null) MDC.setContextMap(previous); else MDC.clear();
                    SecurityContextHolder.setContext(prevCtx);
                }
            };
        };
    }

    @Bean(name = "hrExecutor")
    public ThreadPoolTaskExecutor hrExecutor(TaskDecorator decorator) {
        int cpus = Runtime.getRuntime().availableProcessors();
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(Math.max(4, cpus * 2));
        ex.setMaxPoolSize(Math.max(8, cpus * 4));
        ex.setQueueCapacity(200);
        ex.setThreadNamePrefix("hr-async-");
        ex.setTaskDecorator(decorator);
        RejectedExecutionHandler callerRuns = new ThreadPoolExecutor.CallerRunsPolicy();
        ex.setRejectedExecutionHandler(callerRuns);
        ex.setWaitForTasksToCompleteOnShutdown(true);
        ex.setAwaitTerminationSeconds(15);
        return ex;
    }
}
