package com.hrportal.payroll.client;

import java.math.BigDecimal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hrportal.common.client.HrWebClient;
import com.hrportal.common.client.WebClientFactory;

import reactor.core.publisher.Mono;

/** WebClient call to the Tax service for the monthly TDS of an employee (payroll "retrieves approved tax information"). */
@Component
public class TaxGateway {
    private static final Logger log = LoggerFactory.getLogger(TaxGateway.class);

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MonthlyTds(String employeeId, String month, BigDecimal tds, String regime, boolean declarationApproved) { }

    private final HrWebClient client;

    public TaxGateway(WebClientFactory factory, @Value("${hr.services.tax.url}") String baseUrl) {
        this.client = factory.create(baseUrl);
    }

    /** Non-blocking Mono; the caller (a CompletableFuture stage on the hrExecutor pool) decides when to join. */
    public Mono<MonthlyTds> monthlyTds(String employeeId, String month) {
        // strict on purpose: if the Tax service cannot answer, the employee's payroll entry fails (a silent 0 would under-deduct tax)
        return client.get("/api/v1/tax/monthly-tds?employeeId={id}&month={month}", MonthlyTds.class, employeeId, month);
    }
}
