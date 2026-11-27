package com.hrportal.common.persistence;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Reusable manual DTO mapper (reflection based - the "MapStruct or a reusable manual mapping approach" option).
 * <ul>
 *   <li>{@link #toRecord} entity -> response record (nested objects, collections and enums are mapped recursively)</li>
 *   <li>{@link #toEntity} request record -> new entity</li>
 *   <li>{@link #copyNonNull} request record -> existing entity (PARTIAL update: null components are ignored)</li>
 *   <li>{@link #copyAll} request record -> existing entity (full update)</li>
 * </ul>
 * Properties are matched by name; only properties present on the DTO are ever touched, so ids and audit columns
 * of an entity can never be overwritten from a request.
 */
public final class BeanMapper {
    private static final Map<Class<?>, Map<String, Field>> FIELD_CACHE = new ConcurrentHashMap<>();

    private BeanMapper() {
    }

    public static <T> T toRecord(Object source, Class<T> recordType) {
        if (source == null) return null;
        try {
            RecordComponent[] comps = recordType.getRecordComponents();
            Class<?>[] types = new Class<?>[comps.length];
            Object[] args = new Object[comps.length];
            for (int i = 0; i < comps.length; i++) {
                types[i] = comps[i].getType();
                Object raw = read(source, comps[i].getName());
                Object v = convert(raw, comps[i].getType(), comps[i].getGenericType());
                args[i] = v == null && comps[i].getType().isPrimitive() ? primitiveDefault(comps[i].getType()) : v;
            }
            Constructor<T> ctor = recordType.getDeclaredConstructor(types);
            ctor.setAccessible(true);
            return ctor.newInstance(args);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot map " + source.getClass().getSimpleName() + " -> " + recordType.getSimpleName(), e);
        }
    }

    public static <T> List<T> toRecords(Collection<?> sources, Class<T> recordType) {
        List<T> out = new ArrayList<>(sources.size());
        for (Object s : sources) out.add(toRecord(s, recordType));
        return out;
    }

    public static <E> E toEntity(Object request, Class<E> entityType) {
        try {
            Constructor<E> ctor = entityType.getDeclaredConstructor();
            ctor.setAccessible(true);
            return copyNonNull(request, ctor.newInstance());   // nulls keep the entity's field defaults
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot instantiate " + entityType.getSimpleName(), e);
        }
    }

    public static <E> E copyNonNull(Object request, E target) {
        return copy(request, target, true);
    }

    public static <E> E copyAll(Object request, E target) {
        return copy(request, target, false);
    }

    private static <E> E copy(Object request, E target, boolean skipNulls) {
        if (request == null) return target;
        Map<String, Field> fields = fieldsOf(target.getClass());
        for (RecordComponent rc : request.getClass().getRecordComponents()) {
            Field f = fields.get(rc.getName());
            if (f == null) continue;
            Object raw = read(request, rc.getName());
            if (raw == null && (skipNulls || f.getType().isPrimitive())) continue;
            try {
                f.set(target, convert(raw, f.getType(), f.getGenericType()));
            } catch (IllegalAccessException e) {
                throw new IllegalStateException(e);
            }
        }
        return target;
    }

    // ------------------------------------------------------------------ internals

    private static Map<String, Field> fieldsOf(Class<?> type) {
        return FIELD_CACHE.computeIfAbsent(type, t -> {
            Map<String, Field> map = new java.util.HashMap<>();
            for (Class<?> c = t; c != null && c != Object.class; c = c.getSuperclass()) {
                for (Field f : c.getDeclaredFields()) {
                    int m = f.getModifiers();
                    if (Modifier.isStatic(m) || Modifier.isFinal(m) || Modifier.isTransient(m)) continue;
                    f.setAccessible(true);
                    map.putIfAbsent(f.getName(), f);
                }
            }
            return map;
        });
    }

    @SuppressWarnings("unchecked")
    private static Object read(Object source, String name) {
        if (source instanceof Map<?, ?> m) return ((Map<String, Object>) m).get(name);
        Class<?> c = source.getClass();
        String cap = Character.toUpperCase(name.charAt(0)) + name.substring(1);
        for (String candidate : new String[]{name, "get" + cap, "is" + cap}) {
            try {
                Method m = c.getMethod(candidate);
                if (m.getParameterCount() == 0) return m.invoke(source);
            } catch (NoSuchMethodException ignored) {
                // try next naming convention
            } catch (Exception e) {
                throw new IllegalStateException("Cannot read " + name + " from " + c.getSimpleName(), e);
            }
        }
        Field f = fieldsOf(c).get(name);
        try {
            return f == null ? null : f.get(source);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException(e);
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object convert(Object value, Class<?> target, Type generic) {
        if (value == null) return null;
        if (target.isPrimitive()) target = wrap(target);
        if (Collection.class.isAssignableFrom(target) && value instanceof Collection<?> col) {
            Class<?> elem = Object.class;
            if (generic instanceof ParameterizedType pt && pt.getActualTypeArguments()[0] instanceof Class<?> ec) elem = ec;
            Collection out = Set.class.isAssignableFrom(target) ? new LinkedHashSet<>() : new ArrayList<>();
            for (Object o : col) out.add(convert(o, elem, elem));
            return out;
        }
        if (target.isInstance(value) && !(value instanceof Collection)) return value;
        if (target.isEnum() && value instanceof String s) return Enum.valueOf((Class<Enum>) target, s.trim().toUpperCase());
        if (target == String.class && value instanceof Enum<?> e) return e.name();
        if (target == String.class && (value instanceof Number || value instanceof java.time.temporal.Temporal || value instanceof java.util.UUID)) return value.toString();
        if (value instanceof Number n) {
            if (target == Long.class) return n.longValue();
            if (target == Integer.class) return n.intValue();
            if (target == Double.class) return n.doubleValue();
            if (target == BigDecimal.class) return new BigDecimal(n.toString());
            if (target == Short.class) return n.shortValue();
        }
        if (target.isRecord()) return toRecord(value, target);
        if (!target.isInterface() && !Modifier.isAbstract(target.getModifiers()) && !target.getName().startsWith("java.")) {
            return toEntity(value, target);
        }
        if (target.isAssignableFrom(value.getClass())) return value;
        throw new IllegalArgumentException("Cannot convert " + value.getClass().getSimpleName() + " to " + target.getSimpleName());
    }

    private static Class<?> wrap(Class<?> p) {
        if (p == int.class) return Integer.class;
        if (p == long.class) return Long.class;
        if (p == boolean.class) return Boolean.class;
        if (p == double.class) return Double.class;
        if (p == float.class) return Float.class;
        if (p == short.class) return Short.class;
        if (p == byte.class) return Byte.class;
        return Character.class;
    }

    private static Object primitiveDefault(Class<?> p) {
        if (p == boolean.class) return false;
        if (p == int.class) return 0;
        if (p == long.class) return 0L;
        if (p == double.class) return 0d;
        if (p == float.class) return 0f;
        if (p == short.class) return (short) 0;
        if (p == byte.class) return (byte) 0;
        return '\0';
    }
}
