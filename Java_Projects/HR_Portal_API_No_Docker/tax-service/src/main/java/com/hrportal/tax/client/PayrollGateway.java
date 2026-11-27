package com.hrportal.tax.client;

import java.math.BigDecimal;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hrportal.common.client.HrWebClient;
import com.hrportal.common.client.WebClientFactory;

/** WebClient: Tax Service -> Payroll Service (annual CTC of the employee as the income base). exchangeToMono maps a missing salary (404) to "empty". */
@Component
public class PayrollGateway {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SalarySummary(String employeeId, BigDecimal annualCtc, BigDecimal monthlyCtc) { }

    private final HrWebClient client;

    public PayrollGateway(WebClientFactory factory, @Value("${hr.services.payroll.url}") String baseUrl) {
        this.client = factory.create(baseUrl);
    }

    public Optional<SalarySummary> salary(String employeeId) {
        return client.getOptional("/api/v1/payroll/employees/{id}/salary-summary", SalarySummary.class, employeeId).block();   // block(): servlet request thread
    }
}
