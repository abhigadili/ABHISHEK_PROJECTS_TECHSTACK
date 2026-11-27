package com.hrportal.leave.client;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hrportal.common.client.HrWebClient;
import com.hrportal.common.client.WebClientFactory;

/**
 * WebClient (non-blocking) call to the Holiday service. The result is needed synchronously by the apply workflow, so
 * the single Mono is resolved with block() - justified because this runs on a servlet (blocking) request thread.
 * If the Holiday service is down the leave is still computed (weekends only) and a warning is logged.
 */
@Component
public class HolidayGateway {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(HolidayGateway.class);

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HolidayView(String id, String name, LocalDate holidayDate, String type) { }

    private final HrWebClient client;

    public HolidayGateway(WebClientFactory factory, @Value("${hr.services.holiday.url}") String baseUrl) {
        this.client = factory.create(baseUrl);
    }

    /** Mandatory holidays that apply to the location in the range. */
    public Set<LocalDate> holidays(LocalDate from, LocalDate to, String locationId, String departmentId) {
        try {
            List<HolidayView> list = client.get("/api/v1/holidays/range?from={from}&to={to}" + (locationId == null ? "" : "&locationId={loc}")
                            + (departmentId == null ? "" : "&departmentId={dept}"),
                    new ParameterizedTypeReference<List<HolidayView>>() { }, args(from, to, locationId, departmentId)).block();
            Set<LocalDate> out = new HashSet<>();
            if (list != null) list.stream().filter(h -> "MANDATORY".equals(h.type())).forEach(h -> out.add(h.holidayDate()));
            return out;
        } catch (RuntimeException e) {
            log.warn("Holiday service unavailable ({}), leave duration computed without holidays", e.toString());
            return Set.of();
        }
    }

    private static Object[] args(LocalDate from, LocalDate to, String loc, String dept) {
        java.util.List<Object> a = new java.util.ArrayList<>(List.of(from.toString(), to.toString()));
        if (loc != null) a.add(loc);
        if (dept != null) a.add(dept);
        return a.toArray();
    }
}
