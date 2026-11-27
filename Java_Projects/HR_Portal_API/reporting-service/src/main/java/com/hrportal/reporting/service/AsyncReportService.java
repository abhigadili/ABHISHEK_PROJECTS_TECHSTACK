package com.hrportal.reporting.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import com.hrportal.reporting.dto.ReportDtos.ExecutiveSummary;

/**
 * Executive summary: the independent report sections are computed ASYNCHRONOUSLY on the bounded hrExecutor pool with
 * CompletableFuture.supplyAsync, each section has its own timeout (orTimeout) and fallback (handle), thenCombine merges two sections
 * into a derived figure and allOf joins everything. A slow or failing section degrades to an error note instead of failing the report.
 */
@Service
public class AsyncReportService {
    private final ReportService reports;
    private final Executor executor;

    public AsyncReportService(ReportService reports, @Qualifier("hrExecutor") Executor executor) {
        this.reports = reports;
        this.executor = executor;
    }

    public ExecutiveSummary executiveSummary() {
        long start = System.nanoTime();
        String month = YearMonth.now().toString();
        int year = LocalDate.now().getYear();
        CompletableFuture<Object> headcount = section("headcount", () -> reports.headcount("department"));
        CompletableFuture<Object> joiningExit = section("joiningExit", () -> reports.joiningExit(year));
        CompletableFuture<Object> leave = section("leave", () -> reports.leave(month));
        CompletableFuture<Object> attendance = section("attendance", () -> reports.attendance(month));
        CompletableFuture<Object> timesheets = section("timesheets", () -> reports.timesheets(month));
        CompletableFuture<Object> exits = section("exits", () -> reports.exits());
        // thenCombine: a derived figure that needs two finished sections
        CompletableFuture<Object> attritionNote = joiningExit.thenCombine(headcount, (je, hc) -> {
            if (je instanceof com.hrportal.reporting.dto.ReportDtos.JoiningExitSummary j && hc instanceof com.hrportal.reporting.dto.ReportDtos.HeadcountReport h && h.active() > 0) {
                return Map.of("leaversThisYear", j.totalLeavers(), "activeHeadcount", h.active(), "attritionPercent", Math.round(1000.0 * j.totalLeavers() / h.active()) / 10.0);
            }
            return Map.of("note", "not enough data");
        });
        CompletableFuture.allOf(headcount, joiningExit, leave, attendance, timesheets, exits, attritionNote).join();
        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("headcount", headcount.join());
        sections.put("joiningAndExit", joiningExit.join());
        sections.put("leave", leave.join());
        sections.put("attendance", attendance.join());
        sections.put("timesheets", timesheets.join());
        sections.put("exits", exits.join());
        sections.put("attrition", attritionNote.join());
        return new ExecutiveSummary(sections, TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start));
    }

    private CompletableFuture<Object> section(String name, Supplier<Object> work) {
        return CompletableFuture.supplyAsync(work, executor).orTimeout(15, TimeUnit.SECONDS)
                .handle((value, ex) -> ex == null ? value : Map.of("error", "section '" + name + "' unavailable: " + (ex.getCause() == null ? ex : ex.getCause()).getClass().getSimpleName()));
    }
}
