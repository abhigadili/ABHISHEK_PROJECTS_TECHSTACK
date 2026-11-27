package com.hrportal.employee.util;

import java.lang.reflect.RecordComponent;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Reflection-based change detection: compares two snapshots (records) component by component and reports the ones
 * that differ. Used for the field-level profile-update history. Only the masked DTO view is compared, so no
 * sensitive raw value can ever be written to the history.
 */
public final class FieldDiff {
    private static final Set<String> IGNORED = Set.of("version", "createdAt", "updatedAt");

    private FieldDiff() {
    }

    public record Change(String field, String oldValue, String newValue) { }

    public static List<Change> diff(Record before, Record after) {
        List<Change> changes = new ArrayList<>();
        try {
            for (RecordComponent rc : before.getClass().getRecordComponents()) {
                if (IGNORED.contains(rc.getName())) continue;
                Object a = rc.getAccessor().invoke(before);
                Object b = rc.getAccessor().invoke(after);
                if (!Objects.equals(a, b)) changes.add(new Change(rc.getName(), str(a), str(b)));
            }
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Cannot diff " + before.getClass().getSimpleName(), e);
        }
        return changes;
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o);
        return s.length() > 480 ? s.substring(0, 480) : s;
    }
}
