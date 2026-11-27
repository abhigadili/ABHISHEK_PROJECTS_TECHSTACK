package com.hrportal.tax.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.tax.entity.TaxRule;

/**
 * Income-tax computation driven entirely by the {@link TaxRule} row (slabs, standard deduction, rebate, cess, section caps).
 * taxable = gross - standard deduction - sum(min(declared per section, section cap)); tax = progressive slabs; rebate when taxable is
 * within the rebate limit; cess on (tax - rebate).
 */
@Component
public class TaxEngine {
    private final ObjectMapper mapper;

    public TaxEngine(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public record Slab(BigDecimal from, BigDecimal to, BigDecimal rate) { }

    public record Computation(BigDecimal gross, BigDecimal standardDeduction, BigDecimal deductions, BigDecimal taxable, BigDecimal slabTax, BigDecimal rebate,
                              BigDecimal cess, BigDecimal totalTax) { }

    public Computation compute(BigDecimal gross, TaxRule rule, Map<String, BigDecimal> declaredBySection) {
        Map<String, BigDecimal> caps = readCaps(rule);
        BigDecimal deductions = BigDecimal.ZERO;
        for (Map.Entry<String, BigDecimal> e : declaredBySection.entrySet()) {
            BigDecimal cap = caps.get(e.getKey());
            if (cap == null) continue;                               // section not allowed in this regime
            deductions = deductions.add(e.getValue().min(cap));
        }
        BigDecimal std = rule.getStandardDeduction();
        BigDecimal taxable = gross.subtract(std).subtract(deductions).max(BigDecimal.ZERO);
        BigDecimal slabTax = BigDecimal.ZERO;
        for (Slab s : readSlabs(rule)) {
            BigDecimal upper = s.to() == null ? taxable : taxable.min(s.to());
            BigDecimal inSlab = upper.subtract(s.from()).max(BigDecimal.ZERO);
            slabTax = slabTax.add(inSlab.multiply(s.rate()).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
        }
        slabTax = money(slabTax);
        BigDecimal rebate = taxable.compareTo(rule.getRebateLimit()) <= 0 ? slabTax.min(rule.getRebateAmount()) : BigDecimal.ZERO;
        BigDecimal afterRebate = slabTax.subtract(rebate);
        BigDecimal cess = money(afterRebate.multiply(rule.getCessPercent()).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
        return new Computation(money(gross), money(std), money(deductions), money(taxable), slabTax, money(rebate), cess, money(afterRebate.add(cess)));
    }

    public List<Slab> readSlabs(TaxRule rule) {
        try {
            return mapper.readValue(rule.getSlabs(), new TypeReference<List<Slab>>() { });
        } catch (Exception e) {
            throw new IllegalStateException("Invalid slab configuration for " + rule.getFinancialYear() + "/" + rule.getRegime() + ": " + e.getMessage(), e);
        }
    }

    public Map<String, BigDecimal> readCaps(TaxRule rule) {
        try {
            return mapper.readValue(rule.getSectionLimits(), new TypeReference<Map<String, BigDecimal>>() { });
        } catch (Exception e) {
            throw new IllegalStateException("Invalid section limits for " + rule.getFinancialYear() + "/" + rule.getRegime() + ": " + e.getMessage(), e);
        }
    }

    static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }
}
