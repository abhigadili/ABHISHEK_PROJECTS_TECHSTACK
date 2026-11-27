package com.hrportal.payroll.engine;

import java.math.BigDecimal;

import com.hrportal.payroll.engine.PayrollModel.Context;
import com.hrportal.payroll.engine.PayrollModel.StructureItem;
import com.hrportal.payroll.entity.Enums.CalcType;

/** Strategy: one implementation per {@link CalcType}. Returns the amount for the month (already prorated where applicable). */
public interface ComponentCalculator {
    CalcType supports();

    BigDecimal calculate(StructureItem item, Context ctx);
}
