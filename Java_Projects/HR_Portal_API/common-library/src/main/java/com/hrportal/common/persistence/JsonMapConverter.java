package com.hrportal.common.persistence;

import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Maps a {@code Map<String,Object>} attribute to a MySQL JSON column. */
@Converter
public class JsonMapConverter implements AttributeConverter<Map<String, Object>, String> {
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    @Override
    public String convertToDatabaseColumn(Map<String, Object> attribute) {
        try {
            return attribute == null ? null : MAPPER.writeValueAsString(attribute);
        } catch (Exception e) {
            throw new IllegalArgumentException("Cannot serialise JSON column", e);
        }
    }

    @Override
    public Map<String, Object> convertToEntityAttribute(String dbData) {
        try {
            return dbData == null ? new LinkedHashMap<>() : MAPPER.readValue(dbData, new TypeReference<LinkedHashMap<String, Object>>() { });
        } catch (Exception e) {
            throw new IllegalArgumentException("Cannot read JSON column", e);
        }
    }
}
