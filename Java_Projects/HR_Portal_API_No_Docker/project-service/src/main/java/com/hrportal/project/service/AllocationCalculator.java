package com.hrportal.project.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import com.hrportal.project.entity.ProjectAllocation;

/**
 * Peak-load check by a sweep line: every allocation adds its percentage on its start date and removes it the day after
 * its end date; walking the TreeMap (sorted by date) and keeping a running sum gives the highest concurrent load.
 * An open end date is represented by LocalDate.MAX.
 */
public final class AllocationCalculator {
    private AllocationCalculator() {
    }

    public static BigDecimal peakLoad(List<ProjectAllocation> existing, BigDecimal newPercent, LocalDate from, LocalDate to) {
        TreeMap<LocalDate, BigDecimal> deltas = new TreeMap<>();
        for (ProjectAllocation a : existing) {
            add(deltas, a.getStartDate().isBefore(from) ? from : a.getStartDate(), a.getAllocationPercent());
            LocalDate end = a.getEndDate() == null ? to : (a.getEndDate().isAfter(to) ? to : a.getEndDate());
            add(deltas, end.plusDays(1), a.getAllocationPercent().negate());
        }
        add(deltas, from, newPercent);
        add(deltas, to.plusDays(1), newPercent.negate());
        BigDecimal running = BigDecimal.ZERO;
        BigDecimal peak = BigDecimal.ZERO;
        for (Map.Entry<LocalDate, BigDecimal> e : deltas.entrySet()) {
            if (e.getKey().isAfter(to)) break;
            running = running.add(e.getValue());
            if (running.compareTo(peak) > 0) peak = running;
        }
        return peak;
    }

    private static void add(TreeMap<LocalDate, BigDecimal> m, LocalDate d, BigDecimal v) {
        m.merge(d, v, BigDecimal::add);
    }
}
