package com.hrportal.payroll.engine;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Statutory / payroll parameters parsed from the payroll_config table (nothing is hard-coded in the engine).
 * The shipped values are SAMPLES: statutory rates and slabs MUST be verified against current regulations before real payroll use.
 */
public record PayrollSettings(boolean pfEnabled, BigDecimal pfEmployeePercent, BigDecimal pfWageCeiling, List<PtSlab> ptSlabs,
                              BigDecimal overtimeMultiplier, BigDecimal standardHoursPerDay) {

    /** Professional-tax slab: monthly gross up to {@code upTo} (null = no upper limit) pays {@code amount}. */
    public record PtSlab(BigDecimal upTo, BigDecimal amount) { }

    public static PayrollSettings from(Map<String, String> c, ObjectMapper mapper) {
        try {
            List<PtSlab> slabs = mapper.readValue(c.getOrDefault("statutory.pt.slabs", "[]"), new TypeReference<List<PtSlab>>() { });
            return new PayrollSettings(Boolean.parseBoolean(c.getOrDefault("statutory.pf.enabled", "true")),
                    new BigDecimal(c.getOrDefault("statutory.pf.employee_percent", "12")), new BigDecimal(c.getOrDefault("statutory.pf.wage_ceiling", "15000")),
                    slabs, new BigDecimal(c.getOrDefault("overtime.multiplier", "2")), new BigDecimal(c.getOrDefault("payroll.standard_hours_per_day", "8")));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid payroll configuration: " + e.getMessage(), e);
        }
    }
}
