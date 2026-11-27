package com.hrportal.reporting.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.DoubleSummaryStatistics;
import java.util.IntSummaryStatistics;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;
import java.util.stream.DoubleStream;
import java.util.stream.IntStream;
import java.util.stream.LongStream;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.reporting.entity.ReportFact;
import com.hrportal.reporting.entity.RptEmployee;
import com.hrportal.reporting.repository.ReportingRepositories.EmployeeRepository;
import com.hrportal.reporting.repository.ReportingRepositories.FactRepository;

/**
 * Workforce analytics written as Java Streams pipelines over the reporting tables. Each block below uses a different part of the Streams API
 * on real HR data (employees, leave, payroll, timesheet facts); the result is served by GET /api/v1/reports/analytics/workforce and every
 * operation is explained with its expected output in docs/202611251532-java-streams-guide.md.
 */
@Service
@Transactional(readOnly = true)
public class WorkforceAnalytics {
    private static final Logger log = LoggerFactory.getLogger(WorkforceAnalytics.class);

    private final EmployeeRepository employees;
    private final FactRepository facts;

    public WorkforceAnalytics(EmployeeRepository employees, FactRepository facts) {
        this.employees = employees;
        this.facts = facts;
    }

    public Map<String, Object> analyse() {
        List<RptEmployee> all = employees.findAll();
        List<ReportFact> leave = facts.findByFactType("LEAVE");
        List<ReportFact> payroll = facts.findByFactType("PAYROLL");
        List<ReportFact> timesheets = facts.findByFactType("TIMESHEET");
        Map<String, Object> out = new LinkedHashMap<>();

        // ---------- sources: stream(), Stream.of, Stream.empty, Stream.concat, Stream.iterate, Stream.generate
        out.put("sources", Map.of(
                "fromCollection", all.stream().count(),
                "ofValues", Stream.of("EMPLOYEES", "LEAVE", "PAYROLL").collect(Collectors.joining("+")),
                "emptyStream", Stream.empty().count(),
                "concatenated", Stream.concat(leave.stream(), timesheets.stream()).count(),
                "last6Months", Stream.iterate(YearMonth.now(), m -> m.minusMonths(1)).limit(6).map(YearMonth::toString).toList(),
                "generatedPlaceholders", Stream.generate(() -> "n/a").limit(2).toList()));

        // ---------- intermediate operations: filter, map, flatMap, distinct, sorted, limit, skip, peek, takeWhile, dropWhile
        List<RptEmployee> active = all.stream().filter(e -> "ACTIVE".equals(e.getStatus())).toList();
        List<String> sortedNames = active.stream().map(RptEmployee::getFullName).filter(java.util.Objects::nonNull).distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList();
        List<RptEmployee> byJoining = all.stream().filter(e -> e.getJoiningDate() != null).sorted(Comparator.comparing(RptEmployee::getJoiningDate)).peek(e -> log.trace("considering {}", e.getEmployeeCode())).toList();
        Map<String, Object> intermediate = new LinkedHashMap<>();
        intermediate.put("activeNamesSorted", sortedNames);
        intermediate.put("longestServing3", byJoining.stream().limit(3).map(RptEmployee::getFullName).toList());
        intermediate.put("allButFirst", byJoining.stream().skip(1).count());
        LocalDate cutoff = LocalDate.now().minusYears(1);
        intermediate.put("joinedBeforeLastYear_takeWhile", byJoining.stream().takeWhile(e -> e.getJoiningDate().isBefore(cutoff)).count());
        intermediate.put("joinedWithinLastYear_dropWhile", byJoining.stream().dropWhile(e -> e.getJoiningDate().isBefore(cutoff)).count());
        intermediate.put("departmentsOfManagers_flatMap", all.stream().filter(e -> e.getManagerId() != null).flatMap(e -> Stream.of(e.getManagerId(), e.getDepartmentId())).filter(java.util.Objects::nonNull).distinct().count());
        out.put("intermediate", intermediate);

        // ---------- terminal operations: count, min, max, findFirst, findAny, anyMatch, allMatch, noneMatch, reduce, toArray, forEach
        Map<String, Object> terminal = new LinkedHashMap<>();
        terminal.put("count", all.stream().count());
        terminal.put("earliestJoiner_min", all.stream().filter(e -> e.getJoiningDate() != null).min(Comparator.comparing(RptEmployee::getJoiningDate)).map(RptEmployee::getFullName).orElse(null));
        terminal.put("latestJoiner_max", all.stream().filter(e -> e.getJoiningDate() != null).max(Comparator.comparing(RptEmployee::getJoiningDate)).map(RptEmployee::getFullName).orElse(null));
        Optional<RptEmployee> firstManagerLess = all.stream().filter(e -> e.getManagerId() == null).findFirst();
        terminal.put("firstWithoutManager_findFirst", firstManagerLess.map(RptEmployee::getFullName).orElse("none"));
        terminal.put("anyWithoutManager_findAny", all.stream().filter(e -> e.getManagerId() == null).findAny().isPresent());
        terminal.put("anyOnNotice_anyMatch", all.stream().anyMatch(e -> "ON_NOTICE".equals(e.getStatus())));
        terminal.put("allHaveCode_allMatch", all.stream().allMatch(e -> e.getEmployeeCode() != null));
        terminal.put("noneTerminated_noneMatch", all.stream().noneMatch(e -> "TERMINATED".equals(e.getStatus())));
        terminal.put("totalNetPayroll_reduce", payroll.stream().map(ReportFact::getNumC).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add));
        String[] codes = all.stream().map(RptEmployee::getEmployeeCode).toArray(String[]::new);
        terminal.put("employeeCodes_toArray", codes);
        List<String> collected = new ArrayList<>();
        all.stream().limit(3).forEach(e -> collected.add(e.getEmployeeCode()));
        terminal.put("firstThreeCodes_forEach", collected);
        out.put("terminal", terminal);

        // ---------- primitive streams: mapToInt / mapToLong / mapToDouble, IntStream / LongStream / DoubleStream, boxed
        IntSummaryStatistics tenureMonths = all.stream().filter(e -> e.getJoiningDate() != null).mapToInt(e -> (int) java.time.temporal.ChronoUnit.MONTHS.between(e.getJoiningDate(), LocalDate.now())).summaryStatistics();
        DoubleSummaryStatistics netStats = payroll.stream().filter(f -> f.getNumC() != null).mapToDouble(f -> f.getNumC().doubleValue()).summaryStatistics();
        long totalLeaveMinutes = leave.stream().filter(f -> f.getNumA() != null).mapToLong(f -> f.getNumA().multiply(BigDecimal.valueOf(8 * 60)).longValue()).sum();
        Map<String, Object> primitive = new LinkedHashMap<>();
        primitive.put("tenureMonths_IntSummary", Map.of("min", tenureMonths.getMin(), "max", tenureMonths.getMax(), "avg", tenureMonths.getAverage(), "count", tenureMonths.getCount()));
        primitive.put("netPay_DoubleSummary", Map.of("min", netStats.getMin(), "max", netStats.getMax(), "avg", netStats.getAverage(), "sum", netStats.getSum()));
        primitive.put("leaveMinutes_LongStream", totalLeaveMinutes);
        primitive.put("quarterEndMonths_IntStream", IntStream.rangeClosed(1, 12).filter(m -> m % 3 == 0).boxed().toList());
        primitive.put("cumulative_LongStream", LongStream.rangeClosed(1, 5).map(n -> n * n).sum());
        primitive.put("average_DoubleStream", DoubleStream.of(4.0, 4.5, 5.0).average().orElse(0));
        out.put("primitive", primitive);

        // ---------- collectors: groupingBy, counting, mapping, flatMapping, filtering, partitioningBy, toMap, joining, teeing, collectingAndThen, ...
        Map<String, Object> collectors = new LinkedHashMap<>();
        collectors.put("employeesByDepartment_groupingBy_counting", all.stream().collect(Collectors.groupingBy(e -> String.valueOf(e.getDepartmentId()), TreeMap::new, Collectors.counting())));
        collectors.put("designationsPerDepartment_mapping_toSet", all.stream().collect(Collectors.groupingBy(e -> String.valueOf(e.getDepartmentId()), TreeMap::new, Collectors.mapping(e -> String.valueOf(e.getDesignationId()), Collectors.toSet()))).entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size(), (a, b) -> a, TreeMap::new)));
        collectors.put("employeesPartitionedByStatus_partitioningBy", all.stream().collect(Collectors.partitioningBy(e -> "ACTIVE".equals(e.getStatus()), Collectors.counting())));
        collectors.put("activeByLocation_filtering", all.stream().collect(Collectors.groupingBy(e -> String.valueOf(e.getLocationId()), TreeMap::new, Collectors.filtering(e -> "ACTIVE".equals(e.getStatus()), Collectors.counting()))));
        collectors.put("managersAndReports_flatMapping", all.stream().collect(Collectors.groupingBy(e -> String.valueOf(e.getDepartmentId()), TreeMap::new, Collectors.flatMapping(e -> e.getManagerId() == null ? Stream.<String>empty() : Stream.of(e.getManagerId()), Collectors.toCollection(java.util.TreeSet::new)))).entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size(), (a, b) -> a, TreeMap::new)));
        collectors.put("codeToName_toMap", all.stream().filter(e -> e.getEmployeeCode() != null).collect(Collectors.toMap(RptEmployee::getEmployeeCode, e -> String.valueOf(e.getFullName()), (a, b) -> a, TreeMap::new)));
        collectors.put("codes_joining", all.stream().map(RptEmployee::getEmployeeCode).filter(java.util.Objects::nonNull).sorted().collect(Collectors.joining(", ", "[", "]")));
        collectors.put("statusSet_toSet_collectingAndThen", all.stream().map(RptEmployee::getStatus).collect(Collectors.collectingAndThen(Collectors.toSet(), s -> Set.copyOf(new java.util.TreeSet<>(s)))).size());
        collectors.put("avgAndMaxNet_teeing", payroll.stream().filter(f -> f.getNumC() != null).collect(Collectors.teeing(Collectors.averagingDouble(f -> f.getNumC().doubleValue()),
                Collectors.maxBy(Comparator.comparing(ReportFact::getNumC)), (avg, max) -> Map.of("average", avg, "highestNet", max.map(ReportFact::getNumC).orElse(BigDecimal.ZERO)))));
        collectors.put("leaveByStatus_groupingBy_counting", leave.stream().collect(Collectors.groupingBy(f -> String.valueOf(f.getStatus()), TreeMap::new, Collectors.counting())));
        collectors.put("leaveDaysByType_summingDouble", leave.stream().collect(Collectors.groupingBy(f -> String.valueOf(f.getCategory()), TreeMap::new, Collectors.summingDouble(f -> f.getNumA() == null ? 0 : f.getNumA().doubleValue()))));
        collectors.put("leaveDaysAverage_averagingDouble", leave.stream().collect(Collectors.averagingDouble(f -> f.getNumA() == null ? 0 : f.getNumA().doubleValue())));
        collectors.put("leaveStats_summarizingDouble", leave.stream().collect(Collectors.summarizingDouble(f -> f.getNumA() == null ? 0 : f.getNumA().doubleValue())).toString());
        collectors.put("timesheetHoursByEmployee_reducing", timesheets.stream().filter(f -> f.getNumA() != null).collect(Collectors.groupingBy(ReportFact::getEmployeeId, TreeMap::new, Collectors.reducing(BigDecimal.ZERO, ReportFact::getNumA, BigDecimal::add))));
        collectors.put("highestEarnerByDept_maxBy", payroll.stream().filter(f -> f.getNumC() != null).collect(Collectors.groupingBy(f -> String.valueOf(f.getDepartmentId()), TreeMap::new, Collectors.collectingAndThen(Collectors.maxBy(Comparator.comparing(ReportFact::getNumC)), o -> o.map(ReportFact::getNumC).orElse(BigDecimal.ZERO)))));
        collectors.put("lowestEarnerByDept_minBy", payroll.stream().filter(f -> f.getNumC() != null).collect(Collectors.groupingBy(f -> String.valueOf(f.getDepartmentId()), TreeMap::new, Collectors.collectingAndThen(Collectors.minBy(Comparator.comparing(ReportFact::getNumC)), o -> o.map(ReportFact::getNumC).orElse(BigDecimal.ZERO)))));
        collectors.put("summingInt_averagingInt_summarizingInt", Map.of("sumOfMonthsOfService", all.stream().filter(e -> e.getJoiningDate() != null).collect(Collectors.summingInt(e -> (int) java.time.temporal.ChronoUnit.MONTHS.between(e.getJoiningDate(), LocalDate.now()))),
                "avgMonths", all.stream().filter(e -> e.getJoiningDate() != null).collect(Collectors.averagingInt(e -> (int) java.time.temporal.ChronoUnit.MONTHS.between(e.getJoiningDate(), LocalDate.now()))),
                "summary", all.stream().filter(e -> e.getJoiningDate() != null).collect(Collectors.summarizingInt(e -> (int) java.time.temporal.ChronoUnit.MONTHS.between(e.getJoiningDate(), LocalDate.now()))).toString()));
        collectors.put("summingLong_averagingLong_summarizingLong", Map.of("sum", all.stream().collect(Collectors.summingLong(e -> e.getEmployeeCode() == null ? 0L : e.getEmployeeCode().length())),
                "avg", all.stream().collect(Collectors.averagingLong(e -> e.getEmployeeCode() == null ? 0L : e.getEmployeeCode().length())),
                "summary", all.stream().collect(Collectors.summarizingLong(e -> e.getEmployeeCode() == null ? 0L : e.getEmployeeCode().length())).toString()));
        out.put("collectors", collectors);

        // ---------- parallel streams + groupingByConcurrent (safe because the collector is concurrent and the work is CPU-only)
        ConcurrentMap<String, Long> concurrent = all.parallelStream().collect(Collectors.groupingByConcurrent(e -> String.valueOf(e.getStatus()), Collectors.counting()));
        out.put("parallel", Map.of("statusCounts_parallelStream_groupingByConcurrent", new TreeMap<>(concurrent),
                "sequentialEqualsParallel", all.stream().map(RptEmployee::getStatus).collect(Collectors.groupingBy(s -> s, Collectors.counting())).equals(concurrent)));

        // ---------- lazy evaluation and short-circuiting: nothing runs until the terminal operation, and findFirst stops after the first match
        int[] visited = {0};
        Optional<RptEmployee> shortCircuit = all.stream().peek(e -> visited[0]++).filter(e -> e.getJoiningDate() != null).findFirst();
        out.put("laziness", Map.of("elementsVisitedBeforeFindFirstStopped", visited[0], "totalElements", all.size(), "found", shortCircuit.isPresent()));
        return out;
    }
}
