package com.example.student.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class PhoneNumberValidatorTest {
    private final PhoneNumberValidator validator = new PhoneNumberValidator();

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"+91 9876543210", "9876543210", "(022) 2345-6789", "+14155552671"})
    void acceptsOptionalAndWellFormedNumbers(String phone) { assertThat(validator.isValid(phone, null)).isTrue(); }

    @ParameterizedTest
    @ValueSource(strings = {"12", "abc1234567", "+1234567890123456789", "98-76", "++911234567890"})
    void rejectsMalformedNumbers(String phone) { assertThat(validator.isValid(phone, null)).isFalse(); }
}
