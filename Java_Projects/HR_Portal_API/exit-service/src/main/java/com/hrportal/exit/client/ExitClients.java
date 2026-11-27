package com.hrportal.exit.client;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.stereotype.Component;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hrportal.common.client.HrWebClient;
import com.hrportal.common.client.WebClientFactory;

import reactor.core.publisher.Mono;

/** Exit Service dependencies: Employee through OpenFeign, Payroll and Leave through WebClient (queried in parallel with Mono.zip). */
public final class ExitClients {
    private ExitClients() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EmployeeInfo(String id, String employeeCode, String fullName, String managerId, String departmentId, String status, LocalDate joiningDate, int noticePeriodDays) { }

    @FeignClient(name = "employee-service", url = "${hr.services.employee.url}")
    public interface EmployeeClient {
        @GetMapping("/api/v1/employees/{id}/summary")
        EmployeeInfo summary(@PathVariable("id") String id);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SalaryFacts(String employeeId, BigDecimal monthlyCtc, BigDecimal monthlyBasic) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LoanFacts(String id, String description, BigDecimal outstanding, String status) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LeaveTypeFacts(String id, String code) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Encashable(String leaveTypeCode, BigDecimal encashableDays) { }

    @Component
    public static class SettlementGateway {
        private final HrWebClient payroll;
        private final HrWebClient leave;

        public SettlementGateway(WebClientFactory factory, @Value("${hr.services.payroll.url}") String payrollUrl, @Value("${hr.services.leave.url}") String leaveUrl) {
            this.payroll = factory.create(payrollUrl);
            this.leave = factory.create(leaveUrl);
        }

        public Mono<SalaryFacts> salary(String employeeId) {
            return payroll.get("/api/v1/payroll/employees/{id}/salary-summary", SalaryFacts.class, employeeId);
        }

        public Mono<List<LoanFacts>> loans(String employeeId) {
            return payroll.get("/api/v1/payroll/loans/employee/{id}", new ParameterizedTypeReference<List<LoanFacts>>() { }, employeeId);
        }

        /**
         * Encashable days of the leave types EL and PL for the year. The token is captured HERE (servlet thread) and bound to the client, because the
         * follow-up calls are created inside flatMap, i.e. on a Netty thread with no SecurityContext.
         */
        public Mono<BigDecimal> encashableDays(String employeeId, int year) {
            HrWebClient.Bound bound = leave.as(com.hrportal.common.security.CurrentUser.token(), org.slf4j.MDC.get("correlationId"));
            return bound.get("/api/v1/leaves/types", new ParameterizedTypeReference<List<LeaveTypeFacts>>() { }).flatMap(types -> {
                List<Mono<BigDecimal>> calls = types.stream().filter(t -> "EL".equals(t.code()) || "PL".equals(t.code()))
                        .map(t -> bound.get("/api/v1/leaves/balances/{id}/encashable?leaveTypeId={t}&year={y}", Encashable.class, employeeId, t.id(), year)
                                .map(Encashable::encashableDays).onErrorReturn(BigDecimal.ZERO)).toList();
                return Mono.zip(calls, arr -> java.util.Arrays.stream(arr).map(o -> (BigDecimal) o).reduce(BigDecimal.ZERO, BigDecimal::add));
            });
        }
    }
}
