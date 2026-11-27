package com.hrportal.payroll.service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.payroll.dto.PayrollDtos.ComponentTotal;
import com.hrportal.payroll.dto.PayrollDtos.DepartmentTotal;
import com.hrportal.payroll.dto.PayrollDtos.MonthlyReport;
import com.hrportal.payroll.entity.PayrollEntry;
import com.hrportal.payroll.entity.PayrollEntryLine;
import com.hrportal.payroll.entity.PayrollRun;
import com.hrportal.payroll.repository.PayrollRepositories.EntryRepository;
import com.hrportal.payroll.repository.PayrollRepositories.LineRepository;
import com.hrportal.payroll.repository.PayrollRepositories.RunRepository;

/** Payroll reports built with stream collectors over one month's entries and lines. */
@Service
@Transactional(readOnly = true)
public class PayrollReportService {
    private final RunRepository runs;
    private final EntryRepository entries;
    private final LineRepository lines;

    public PayrollReportService(RunRepository runs, EntryRepository entries, LineRepository lines) {
        this.runs = runs;
        this.entries = entries;
        this.lines = lines;
    }

    public MonthlyReport monthly(String month) {
        PayrollRun r = run(month);
        List<PayrollEntry> list = entries.findByRunId(r.getId());
        BigDecimal avg = list.isEmpty() ? BigDecimal.ZERO : r.getTotalNet().divide(BigDecimal.valueOf(list.size()), 2, java.math.RoundingMode.HALF_UP);
        return new MonthlyReport(month, r.getStatus().name(), list.size(), r.getTotalGross(), r.getTotalDeductions(), r.getTotalNet(), avg);
    }

    /** Payroll deductions (and earnings) grouped by component: groupingBy + summingBy / counting via a downstream collector. */
    public List<ComponentTotal> byComponent(String month) {
        PayrollRun r = run(month);
        List<String> entryIds = entries.findByRunId(r.getId()).stream().map(PayrollEntry::getId).toList();
        Map<String, List<PayrollEntryLine>> grouped = lines.findByEntryIdIn(entryIds).stream().collect(Collectors.groupingBy(l -> l.getType() + ":" + l.getComponentCode(), LinkedHashMap::new, Collectors.toList()));
        return grouped.values().stream().map(g -> new ComponentTotal(g.get(0).getComponentCode(), g.get(0).getComponentName(), g.get(0).getType().name(),
                        g.stream().map(PayrollEntryLine::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add), g.stream().map(PayrollEntryLine::getEntryId).distinct().count()))
                .sorted(Comparator.comparing(ComponentTotal::type).thenComparing(ComponentTotal::total, Comparator.reverseOrder())).toList();
    }

    public List<DepartmentTotal> byDepartment(String month) {
        PayrollRun r = run(month);
        return entries.findByRunId(r.getId()).stream().collect(Collectors.groupingBy(e -> String.valueOf(e.getDepartmentId()))).entrySet().stream().map(en -> {
            List<PayrollEntry> g = en.getValue();
            return new DepartmentTotal(en.getKey(), g.size(), sum(g, PayrollEntry::getGross), sum(g, PayrollEntry::getDeductions), sum(g, PayrollEntry::getNet));
        }).sorted(Comparator.comparing(DepartmentTotal::net).reversed()).toList();
    }

    private static BigDecimal sum(List<PayrollEntry> g, java.util.function.Function<PayrollEntry, BigDecimal> f) {
        return g.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private PayrollRun run(String month) {
        return runs.findByPayrollMonth(month).orElseThrow(() -> ResourceNotFoundException.of("Payroll run for", month));
    }
}
