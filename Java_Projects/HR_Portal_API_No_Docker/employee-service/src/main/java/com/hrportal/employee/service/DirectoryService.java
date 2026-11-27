package com.hrportal.employee.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.web.PageResponse;
import com.hrportal.employee.dto.EmployeeDtos.DepartmentStatusCount;
import com.hrportal.employee.dto.EmployeeDtos.DirectoryEntry;
import com.hrportal.employee.dto.EmployeeDtos.DirectoryGroups;
import com.hrportal.employee.dto.EmployeeDtos.ManagerSpan;
import com.hrportal.employee.entity.Enums.EmployeeStatus;
import com.hrportal.employee.repository.DirectoryView;
import com.hrportal.employee.repository.EmployeeRepository;

/**
 * Company directory. Uses a projection (only non-sensitive columns are read) and Redis caching (evicted on every
 * employee change). The grouped view shows practical Java collections: TreeMap (sorted by initial), EnumMap +
 * EnumSet (status handling), LinkedHashMap (stable output order), unmodifiable lists.
 */
@Service
@Transactional(readOnly = true)
public class DirectoryService {
    /** Statuses visible in the directory: people who are still part of the company. */
    private static final Set<EmployeeStatus> VISIBLE = EnumSet.of(EmployeeStatus.ACTIVE, EmployeeStatus.ON_NOTICE);

    private final EmployeeRepository employees;

    public DirectoryService(EmployeeRepository employees) {
        this.employees = employees;
    }

    @Cacheable(cacheNames = "employeeDirectory", key = "'page:' + #q + ':' + #pageable.pageNumber + ':' + #pageable.pageSize + ':' + #pageable.sort")
    public PageResponse<DirectoryEntry> directory(String q, Pageable pageable) {
        String like = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Page<DirectoryView> page = employees.directory(VISIBLE, like, pageable);
        return PageResponse.of(page, DirectoryService::toEntry);
    }

    @Cacheable(cacheNames = "employeeDirectory", key = "'grouped'")
    public DirectoryGroups grouped() {
        List<DirectoryEntry> all = new ArrayList<>(employees.directory(VISIBLE, null, Pageable.unpaged()).map(DirectoryService::toEntry).getContent());
        all.sort(Comparator.comparing(DirectoryEntry::fullName, String.CASE_INSENSITIVE_ORDER));
        Map<String, List<DirectoryEntry>> byInitial = new TreeMap<>();               // TreeMap keeps A..Z order
        for (DirectoryEntry e : all) {
            String initial = e.fullName().isEmpty() ? "#" : e.fullName().substring(0, 1).toUpperCase();
            byInitial.computeIfAbsent(initial, k -> new ArrayList<>()).add(e);
        }
        byInitial.replaceAll((k, v) -> Collections.unmodifiableList(v));
        Map<EmployeeStatus, Long> counts = new EnumMap<>(EmployeeStatus.class);      // EnumMap: array-backed, ordered by enum
        for (EmployeeStatus s : EmployeeStatus.values()) counts.put(s, 0L);
        for (Object[] row : employees.countByStatusNative()) counts.put(EmployeeStatus.valueOf((String) row[0]), ((Number) row[1]).longValue());
        Map<String, Long> byStatus = new LinkedHashMap<>();
        counts.forEach((k, v) -> byStatus.put(k.name(), v));
        return new DirectoryGroups(all.size(), byInitial, byStatus);
    }

    /** Headcount per department and status (Criteria API group-by). */
    public List<DepartmentStatusCount> headcount() {
        return employees.headcountByDepartmentAndStatus();
    }

    /** Managers with the most active direct reports (span of control). */
    public List<ManagerSpan> spanOfControl(int limit) {
        return employees.topManagersBySpan(Math.max(1, Math.min(limit, 50)));
    }

    private static DirectoryEntry toEntry(DirectoryView v) {
        return new DirectoryEntry(v.getId(), v.getEmployeeCode(), (v.getFirstName() + " " + v.getLastName()).trim(), v.getWorkEmail(),
                v.getDepartmentId(), v.getDesignationId(), v.getLocationId(), v.getStatus().name());
    }
}
