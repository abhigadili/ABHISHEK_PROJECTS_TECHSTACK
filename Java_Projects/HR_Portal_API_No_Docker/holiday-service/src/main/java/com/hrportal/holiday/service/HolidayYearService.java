package com.hrportal.holiday.service;

import org.springframework.stereotype.Service;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.persistence.CrudService;
import com.hrportal.holiday.dto.HolidayDtos.HolidayYearRequest;
import com.hrportal.holiday.dto.HolidayDtos.HolidayYearResponse;
import com.hrportal.holiday.entity.HolidayYear;
import com.hrportal.holiday.repository.HolidayYearRepository;

@Service
public class HolidayYearService extends CrudService<HolidayYear, HolidayYearRequest, HolidayYearResponse> {

    public HolidayYearService(HolidayYearRepository repo, AuditService audit) {
        super(repo, audit, HolidayYear.class, HolidayYearResponse.class);
    }

    @Override
    protected void beforeCreate(HolidayYear y, HolidayYearRequest r) {
        validate(y);
    }

    @Override
    protected void beforeUpdate(HolidayYear y, HolidayYearRequest r) {
        validate(y);
    }

    private void validate(HolidayYear y) {
        if (y.getEndDate().isBefore(y.getStartDate())) throw new BadRequestException("endDate must be on or after startDate");
    }
}
