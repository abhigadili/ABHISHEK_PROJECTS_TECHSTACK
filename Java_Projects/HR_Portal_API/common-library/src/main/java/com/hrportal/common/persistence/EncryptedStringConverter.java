package com.hrportal.common.persistence;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** JPA AttributeConverter: the database only ever stores the AES-GCM ciphertext of the value. */
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {
    @Override
    public String convertToDatabaseColumn(String attribute) {
        return CryptoKeyHolder.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return CryptoKeyHolder.decrypt(dbData);
    }
}
