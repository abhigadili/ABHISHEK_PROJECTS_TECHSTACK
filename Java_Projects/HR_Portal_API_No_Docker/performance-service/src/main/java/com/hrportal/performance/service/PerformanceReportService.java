package com.hrportal.performance.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.performance.dto.PerformanceDtos.CycleSummary;
import com.hrportal.performance.entity.Enums.ReviewStatus;
import com.hrportal.performance.entity.PerformanceReview;
import com.hrportal.performance.entity.ReviewCycle;
import com.hrportal.performance.repository.PerformanceRepositories.ReviewRepository;
import com.hrportal.performance.service.FormCycleService.CycleService;

/** Cycle report with stream collectors: counting by status, averaging ratings, distribution of final ratings (TreeMap keeps 1..5 ordered). */
@Service
@Transactional(readOnly = true)
public class PerformanceReportService {
    private final ReviewRepository reviews;
    private final CycleService cycles;

    public PerformanceReportService(ReviewRepository reviews, CycleService cycles) {
        this.reviews = reviews;
        this.cycles = cycles;
    }

    public CycleSummary summary(String cycleId) {
        ReviewCycle c = cycles.find(cycleId);
        List<PerformanceReview> list = reviews.findByCycleId(cycleId);
        Map<ReviewStatus, Long> counted = new EnumMap<>(ReviewStatus.class);
        for (ReviewStatus s : ReviewStatus.values()) counted.put(s, 0L);
        counted.putAll(list.stream().collect(Collectors.groupingBy(PerformanceReview::getStatus, Collectors.counting())));
        Map<String, Long> byStatus = new LinkedHashMap<>();
        counted.forEach((k, v) -> byStatus.put(k.name(), v));
        Map<String, Long> distribution = new TreeMap<>(list.stream().filter(r -> r.getFinalRating() != null)
                .collect(Collectors.groupingBy(r -> r.getFinalRating().setScale(0, RoundingMode.HALF_UP).toPlainString(), Collectors.counting())));
        return new CycleSummary(c.getId(), c.getName(), list.size(), byStatus, avg(list, PerformanceReview::getSelfRating), avg(list, PerformanceReview::getManagerRating),
                avg(list, PerformanceReview::getFinalRating), distribution);
    }

    private static BigDecimal avg(List<PerformanceReview> list, Function<PerformanceReview, BigDecimal> f) {
        List<BigDecimal> values = list.stream().map(f).filter(java.util.Objects::nonNull).toList();
        if (values.isEmpty()) return null;
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }
}
