package com.hrportal.holiday.service;

import java.time.LocalDate;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.CacheEvictor;
import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.HolidayChanged;
import com.hrportal.common.events.Topics;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.holiday.dto.HolidayDtos.HolidayCalendar;
import com.hrportal.holiday.dto.HolidayDtos.HolidayRequest;
import com.hrportal.holiday.dto.HolidayDtos.HolidayResponse;
import com.hrportal.holiday.entity.Holiday;
import com.hrportal.holiday.entity.HolidayScope;
import com.hrportal.holiday.entity.ScopeType;
import com.hrportal.holiday.repository.HolidayRepository;
import com.hrportal.holiday.repository.HolidayYearRepository;

/** Holiday CRUD + calendar queries (by year / range / location / department). Reads are Redis-cached, writes evict. */
@Service
public class HolidayService {
    private final HolidayRepository holidays;
    private final HolidayYearRepository years;
    private final AuditService audit;
    private final EventPublisher events;
    private final CacheEvictor cache;

    public HolidayService(HolidayRepository holidays, HolidayYearRepository years, AuditService audit, EventPublisher events, CacheEvictor cache) {
        this.holidays = holidays;
        this.years = years;
        this.audit = audit;
        this.events = events;
        this.cache = cache;
    }

    @Transactional
    public HolidayResponse create(HolidayRequest req) {
        if (holidays.existsByHolidayDateAndNameIgnoreCase(req.holidayDate(), req.name())) {
            throw new ConflictException("A holiday named '" + req.name() + "' already exists on " + req.holidayDate());
        }
        checkWithinConfiguredYear(req.holidayDate());
        Holiday h = BeanMapper.toEntity(req, Holiday.class);
        h = holidays.save(h);
        publish(h, "CREATED");
        HolidayResponse r = toResponse(h);
        audit.record("Holiday", h.getId(), "CREATED", r);
        return r;
    }

    @Transactional
    public HolidayResponse update(String id, HolidayRequest req) {
        Holiday h = find(id);
        HolidayResponse before = toResponse(h);
        if (req.holidayDate() != null) checkWithinConfiguredYear(req.holidayDate());
        BeanMapper.copyNonNull(req, h);
        h = holidays.save(h);
        publish(h, "UPDATED");
        HolidayResponse after = toResponse(h);
        audit.record("Holiday", id, "UPDATED", before, after);
        return after;
    }

    @Transactional
    public void delete(String id) {
        Holiday h = find(id);
        HolidayResponse before = toResponse(h);
        h.markDeleted();
        holidays.save(h);
        publish(h, "DELETED");
        audit.record("Holiday", id, "DELETED", before, null);
    }

    @Transactional(readOnly = true)
    public HolidayResponse get(String id) {
        return toResponse(find(id));
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "holidayCalendar", key = "'year:' + #year + ':' + #locationId + ':' + #departmentId")
    public List<HolidayResponse> byYear(int year, String locationId, String departmentId) {
        return holidays.findByHolidayYearOrderByHolidayDate(year).stream().filter(applies(locationId, departmentId)).map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "holidayCalendar", key = "'range:' + #from + ':' + #to + ':' + #locationId + ':' + #departmentId")
    public List<HolidayResponse> range(LocalDate from, LocalDate to, String locationId, String departmentId) {
        if (to.isBefore(from)) throw new BadRequestException("'to' must not be before 'from'");
        if (from.plusYears(2).isBefore(to)) throw new BadRequestException("Range is limited to 2 years");
        return holidays.findByHolidayDateBetweenOrderByHolidayDate(from, to).stream().filter(applies(locationId, departmentId)).map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<HolidayResponse> upcoming(int limit, String locationId, String departmentId) {
        LocalDate today = LocalDate.now();
        return holidays.findByHolidayDateBetweenOrderByHolidayDate(today, today.plusYears(1)).stream()
                .filter(applies(locationId, departmentId)).limit(Math.max(1, Math.min(limit, 50))).map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public HolidayCalendar calendar(int year, String locationId, String departmentId) {
        List<HolidayResponse> all = byYear(year, locationId, departmentId);
        Map<String, List<HolidayResponse>> months = new LinkedHashMap<>();
        for (Month m : Month.values()) months.put(m.getDisplayName(TextStyle.FULL, Locale.ENGLISH), List.of());
        all.stream().collect(Collectors.groupingBy(h -> h.holidayDate().getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH)))
                .forEach(months::put);
        return new HolidayCalendar(year, all.size(), months);
    }

    /** A holiday applies when it has no scope at all, or one scope matches the requested location / department. */
    private Predicate<Holiday> applies(String locationId, String departmentId) {
        return h -> h.getScopes().isEmpty() || h.getScopes().stream().anyMatch(s ->
                (s.getScopeType() == ScopeType.LOCATION && s.getScopeId().equals(locationId))
                        || (s.getScopeType() == ScopeType.DEPARTMENT && s.getScopeId().equals(departmentId)));
    }

    private void checkWithinConfiguredYear(LocalDate date) {
        years.findByYearNumber(date.getYear()).ifPresent(y -> {
            if (date.isBefore(y.getStartDate()) || date.isAfter(y.getEndDate())) {
                throw new BadRequestException("Date " + date + " is outside the configured holiday year " + y.getYearNumber());
            }
        });
    }

    private Holiday find(String id) {
        return holidays.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Holiday", id));
    }

    private HolidayResponse toResponse(Holiday h) {
        return BeanMapper.toRecord(h, HolidayResponse.class);
    }

    private void publish(Holiday h, String action) {
        cache.clear("holidayCalendar");
        String scope = h.getScopes().stream().filter(s -> s.getScopeType() == ScopeType.LOCATION).map(HolidayScope::getScopeId).findFirst().orElse(null);
        events.publish(Topics.HOLIDAY_CHANGED, h.getId(), new HolidayChanged(EventMetadata.of(Topics.HOLIDAY_CHANGED), null,
                h.getId(), h.getName(), h.getHolidayDate(), action, scope));
    }
}
