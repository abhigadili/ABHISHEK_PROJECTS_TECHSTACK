package com.hrportal.common.validation;

import java.time.LocalDate;

/** Implemented by request records that carry a start / end date pair; checked by {@link ValidDateRange}. */
public interface DateRangeAware {
    LocalDate rangeStart();

    LocalDate rangeEnd();
}
