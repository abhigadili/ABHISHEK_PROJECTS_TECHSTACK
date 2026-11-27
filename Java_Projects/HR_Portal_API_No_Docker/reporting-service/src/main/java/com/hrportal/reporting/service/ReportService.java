package com.hrportal.reporting.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.exception.BadRequestException;
import com.hrportal.reporting.client.DepartmentNames;
import com.hrportal.reporting.dto.ReportDtos.AttendanceReport;
import com.hrportal.reporting.dto.ReportDtos.AttendanceReportRow;
import com.hrportal.reporting.dto.ReportDtos.CountRow;
import com.hrportal.reporting.dto.ReportDtos.ExitReport;
import com.hrportal.reporting.dto.ReportDtos.HeadcountReport;
import com.hrportal.reporting.dto.ReportDtos.JoiningExitSummary;
import com.hrportal.reporting.dto.ReportDtos.LeaveReport;
import com.hrportal.reporting.dto.ReportDtos.LeaveReportRow;
import com.hrportal.reporting.dto.ReportDtos.MonthRow;
import com.hrportal.reporting.dto.ReportDtos.PayrollDepartmentRow;
import com.hrportal.reporting.dto.ReportDtos.PayrollReport;
import com.hrportal.reporting.dto.ReportDtos.PerformanceReport;
import com.hrportal.reporting.dto.ReportDtos.ProjectAllocationRow;
import com.hrportal.reporting.dto.ReportDtos.TaxReport;
import com.hrportal.reporting.dto.ReportDtos.TimesheetReport;
import com.hrportal.reporting.dto.ReportDtos.TimesheetReportRow;
import com.hrportal.reporting.entity.ReportFact;
import com.hrportal.reporting.entity.RptEmployee;
import com.hrportal.reporting.repository.ReportingRepositories.EmployeeRepository;
import com.hrportal.reporting.repository.ReportingRepositories.FactRepository;

/** The reports: SQL / JPQL aggregates over the Kafka-maintained reporting tables, shaped with stream collectors. No other service database is ever read. */
@Service
@Transactional(readOnly = true)
public class ReportService {
    private static final Set<String> GROUPS = Set.of("department", "location", "designation", "status");
    private static final BigDecimal ZERO = BigDecimal.ZERO;

    private final EmployeeRepository employees;
    private final FactRepository facts;
    private final DepartmentNames names;

    public ReportService(EmployeeRepository employees, FactRepository facts, DepartmentNames names) {
        this.employees = employees;
        this.facts = facts;
        this.names = names;
    }

    // ------------------------------------------------------------------ employees / departments
    public HeadcountReport headcount(String groupBy) {
        if (!GROUPS.contains(groupBy)) throw new BadRequestException("groupBy must be one of " + GROUPS);
        List<RptEmployee> all = employees.findAll();
        Function<RptEmployee, String> key = switch (groupBy) {
            case "department" -> e -> String.valueOf(e.getDepartmentId());
            case "location" -> e -> String.valueOf(e.getLocationId());
            case "designation" -> e -> String.valueOf(e.getDesignationId());
            default -> RptEmployee::getStatus;
        };
        List<RptEmployee> current = all.stream().filter(e -> "ACTIVE".equals(e.getStatus()) || "ON_NOTICE".equals(e.getStatus())).toList();
        List<CountRow> rows = current.stream().collect(Collectors.groupingBy(key, Collectors.counting())).entrySet().stream()
                .map(en -> new CountRow(en.getKey(), "department".equals(groupBy) ? names.name(en.getKey()) : en.getKey(), en.getValue()))
                .sorted(Comparator.comparingLong(CountRow::count).reversed().thenComparing(CountRow::label)).toList();
        Map<String, Long> byStatus = all.stream().collect(Collectors.groupingBy(RptEmployee::getStatus, TreeMap::new, Collectors.counting()));
        return new HeadcountReport(groupBy, all.size(), current.size(), rows, byStatus);
    }

    public JoiningExitSummary joiningExit(int year) {
        List<RptEmployee> all = employees.findAll();
        Map<String, Long> joiners = all.stream().filter(e -> e.getJoiningDate() != null && e.getJoiningDate().getYear() == year)
                .collect(Collectors.groupingBy(e -> YearMonth.from(e.getJoiningDate()).toString(), TreeMap::new, Collectors.counting()));
        Map<String, Long> leavers = all.stream().filter(e -> e.getExitDate() != null && e.getExitDate().getYear() == year)
                .collect(Collectors.groupingBy(e -> YearMonth.from(e.getExitDate()).toString(), TreeMap::new, Collectors.counting()));
        List<MonthRow> j = joiners.entrySet().stream().map(e -> new MonthRow(e.getKey(), e.getValue())).toList();
        List<MonthRow> l = leavers.entrySet().stream().map(e -> new MonthRow(e.getKey(), e.getValue())).toList();
        long tj = joiners.values().stream().mapToLong(Long::longValue).sum();
        long tl = leavers.values().stream().mapToLong(Long::longValue).sum();
        return new JoiningExitSummary(year, j, l, tj, tl, tj - tl);
    }

    // ------------------------------------------------------------------ leave
    public LeaveReport leave(String period) {
        List<ReportFact> list = period == null ? facts.findByFactType("LEAVE") : facts.findByFactTypeAndPeriodKeyStartingWith("LEAVE", period);
        Map<String, List<ReportFact>> grouped = list.stream().collect(Collectors.groupingBy(f -> f.getCategory() + "|" + f.getStatus(), TreeMap::new, Collectors.toList()));
        List<LeaveReportRow> rows = grouped.values().stream().map(g -> new LeaveReportRow(g.get(0).getCategory(), g.get(0).getStatus(), g.size(),
                g.stream().map(f -> nz(f.getNumA())).reduce(ZERO, BigDecimal::add))).toList();
        BigDecimal approved = rows.stream().filter(r -> "APPROVED".equals(r.status())).map(LeaveReportRow::days).reduce(ZERO, BigDecimal::add);
        return new LeaveReport(period == null ? "all" : period, rows, approved);
    }

    // ------------------------------------------------------------------ attendance
    public AttendanceReport attendance(String month) {
        List<ReportFact> list = facts.findByFactTypeAndPeriodKey("ATTENDANCE", month);
        // department is resolved NOW from the employee table (the employee event may have arrived after the attendance event)
        Map<String, String> deptOf = employees.findAllById(list.stream().map(ReportFact::getEmployeeId).collect(Collectors.toSet())).stream()
                .filter(e -> e.getDepartmentId() != null).collect(Collectors.toMap(RptEmployee::getEmployeeId, RptEmployee::getDepartmentId));
        Map<String, List<ReportFact>> byDept = list.stream().collect(Collectors.groupingBy(f -> String.valueOf(deptOf.getOrDefault(f.getEmployeeId(), f.getDepartmentId()))));
        List<AttendanceReportRow> rows = byDept.entrySet().stream().map(en -> {
            List<ReportFact> g = en.getValue();
            List<BigDecimal> worked = g.stream().map(ReportFact::getNumA).filter(java.util.Objects::nonNull).toList();
            BigDecimal avg = worked.isEmpty() ? ZERO : worked.stream().reduce(ZERO, BigDecimal::add).divide(BigDecimal.valueOf(worked.size()), 1, RoundingMode.HALF_UP);
            return new AttendanceReportRow(en.getKey(), names.name(en.getKey()), g.size(), avg, g.stream().filter(f -> nz(f.getNumB()).signum() > 0).count(),
                    g.stream().map(f -> nz(f.getNumC())).reduce(ZERO, BigDecimal::add));
        }).sorted(Comparator.comparing(AttendanceReportRow::departmentName)).toList();
        return new AttendanceReport(month, rows);
    }

    // ------------------------------------------------------------------ payroll / tax
    public PayrollReport payroll(String month) {
        List<ReportFact> list = facts.findByFactTypeAndPeriodKey("PAYROLL", month);
        BigDecimal gross = sum(list, ReportFact::getNumA), ded = sum(list, ReportFact::getNumB), net = sum(list, ReportFact::getNumC);
        List<PayrollDepartmentRow> depts = list.stream().collect(Collectors.groupingBy(f -> String.valueOf(f.getDepartmentId()))).entrySet().stream()
                .map(en -> new PayrollDepartmentRow(en.getKey(), names.name(en.getKey()), en.getValue().size(), sum(en.getValue(), ReportFact::getNumA), sum(en.getValue(), ReportFact::getNumB),
                        sum(en.getValue(), ReportFact::getNumC))).sorted(Comparator.comparing(PayrollDepartmentRow::net).reversed()).toList();
        return new PayrollReport(month, list.size(), gross, ded, net, list.isEmpty() ? ZERO : net.divide(BigDecimal.valueOf(list.size()), 2, RoundingMode.HALF_UP), depts);
    }

    public TaxReport tax(String financialYear) {
        List<ReportFact> list = facts.findByFactTypeAndPeriodKey("TAX", financialYear);
        return new TaxReport(financialYear, list.stream().collect(Collectors.groupingBy(f -> String.valueOf(f.getStatus()), TreeMap::new, Collectors.counting())),
                sum(list, ReportFact::getNumA), list.stream().collect(Collectors.groupingBy(f -> String.valueOf(f.getCategory()), TreeMap::new, Collectors.counting())));
    }

    // ------------------------------------------------------------------ projects / timesheets / performance / exits
    public List<ProjectAllocationRow> allocation() {
        return facts.findByFactType("ALLOCATION").stream().filter(f -> "ACTIVE".equals(f.getStatus())).collect(Collectors.groupingBy(ReportFact::getPeriodKey)).entrySet().stream().map(en -> {
            List<ReportFact> g = en.getValue();
            BigDecimal total = sum(g, ReportFact::getNumA);
            return new ProjectAllocationRow(en.getKey(), g.get(0).getCategory(), g.size(), total.divide(BigDecimal.valueOf(g.size()), 1, RoundingMode.HALF_UP), total);
        }).sorted(Comparator.comparingLong(ProjectAllocationRow::employees).reversed()).toList();
    }

    public TimesheetReport timesheets(String month) {
        List<ReportFact> list = facts.findByFactTypeAndPeriodKey("TIMESHEET", month).stream().filter(f -> "APPROVED".equals(f.getStatus())).toList();
        Map<String, String> nameById = employees.findAllById(list.stream().map(ReportFact::getEmployeeId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(RptEmployee::getEmployeeId, e -> String.valueOf(e.getFullName())));
        List<TimesheetReportRow> rows = list.stream().collect(Collectors.groupingBy(ReportFact::getEmployeeId)).entrySet().stream().map(en -> {
            BigDecimal total = sum(en.getValue(), ReportFact::getNumA), billable = sum(en.getValue(), ReportFact::getNumB);
            return new TimesheetReportRow(en.getKey(), nameById.getOrDefault(en.getKey(), en.getKey()), total, billable,
                    total.signum() == 0 ? ZERO : billable.multiply(BigDecimal.valueOf(100)).divide(total, 1, RoundingMode.HALF_UP));
        }).sorted(Comparator.comparing(TimesheetReportRow::totalHours).reversed()).toList();
        return new TimesheetReport(month, sum(list, ReportFact::getNumA), sum(list, ReportFact::getNumB), rows);
    }

    public PerformanceReport performance(String cycleId) {
        List<ReportFact> list = facts.findByFactTypeAndPeriodKey("REVIEW", cycleId);
        Map<String, Long> dist = list.stream().filter(f -> f.getNumC() != null).collect(Collectors.groupingBy(f -> f.getNumC().setScale(0, RoundingMode.HALF_UP).toPlainString(), TreeMap::new, Collectors.counting()));
        return new PerformanceReport(cycleId, list.size(), list.stream().filter(f -> "APPROVED".equals(f.getStatus())).count(), avg(list, ReportFact::getNumA), avg(list, ReportFact::getNumB), avg(list, ReportFact::getNumC), dist);
    }

    public ExitReport exits() {
        List<ReportFact> list = facts.findByFactType("EXIT");
        Map<String, Long> byStatus = list.stream().collect(Collectors.groupingBy(f -> String.valueOf(f.getStatus()), TreeMap::new, Collectors.counting()));
        List<MonthRow> byMonth = list.stream().filter(f -> f.getPeriodKey() != null).collect(Collectors.groupingBy(ReportFact::getPeriodKey, TreeMap::new, Collectors.counting())).entrySet().stream()
                .map(e -> new MonthRow(e.getKey(), e.getValue())).toList();
        return new ExitReport(byStatus.getOrDefault("RESIGNED", 0L), byStatus.getOrDefault("EXITED", 0L), avg(list, ReportFact::getNumA), byMonth, byStatus);
    }

    private static BigDecimal sum(List<ReportFact> l, Function<ReportFact, BigDecimal> f) {
        return l.stream().map(f).filter(java.util.Objects::nonNull).reduce(ZERO, BigDecimal::add);
    }

    private static BigDecimal avg(List<ReportFact> l, Function<ReportFact, BigDecimal> f) {
        List<BigDecimal> v = l.stream().map(f).filter(java.util.Objects::nonNull).toList();
        return v.isEmpty() ? null : v.stream().reduce(ZERO, BigDecimal::add).divide(BigDecimal.valueOf(v.size()), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? ZERO : v;
    }
}
