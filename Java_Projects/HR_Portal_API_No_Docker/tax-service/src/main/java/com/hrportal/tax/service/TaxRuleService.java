package com.hrportal.tax.service;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.tax.dto.TaxDtos.RuleRequest;
import com.hrportal.tax.dto.TaxDtos.RuleResponse;
import com.hrportal.tax.dto.TaxDtos.SlabDto;
import com.hrportal.tax.entity.Enums.Regime;
import com.hrportal.tax.entity.TaxRule;
import com.hrportal.tax.repository.TaxRepositories.RuleRepository;

/** Maintains the configurable tax rules (financial year + regime). */
@Service
@Transactional
public class TaxRuleService {
    private final RuleRepository rules;
    private final ObjectMapper mapper;
    private final AuditService audit;

    public TaxRuleService(RuleRepository rules, ObjectMapper mapper, AuditService audit) {
        this.rules = rules;
        this.mapper = mapper;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<RuleResponse> list(String financialYear) {
        List<TaxRule> list = financialYear == null ? rules.findAll() : rules.findByFinancialYearOrderByRegime(financialYear);
        return list.stream().map(this::toResponse).toList();
    }

    public RuleResponse create(RuleRequest req) {
        if (rules.existsByFinancialYearAndRegime(req.financialYear(), Regime.valueOf(req.regime()))) throw new ConflictException("A rule already exists for " + req.financialYear() + " / " + req.regime());
        TaxRule r = new TaxRule();
        apply(r, req);
        r.setFinancialYear(req.financialYear());
        r.setRegime(Regime.valueOf(req.regime()));
        r = rules.save(r);
        audit.record("TaxRule", r.getId(), "CREATED", toResponse(r));
        return toResponse(r);
    }

    public RuleResponse update(String id, RuleRequest req) {
        TaxRule r = rules.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Tax rule", id));
        RuleResponse before = toResponse(r);
        apply(r, req);
        r = rules.save(r);
        audit.record("TaxRule", id, "UPDATED", before, toResponse(r));
        return toResponse(r);
    }

    private void apply(TaxRule r, RuleRequest req) {
        try {
            for (int i = 1; i < req.slabs().size(); i++) {
                SlabDto prev = req.slabs().get(i - 1);
                if (prev.to() == null || prev.to().compareTo(req.slabs().get(i).from()) != 0) throw new BadRequestException("Slabs must be contiguous: slab " + i + " must start where the previous one ends");
            }
            if (req.slabs().get(req.slabs().size() - 1).to() != null) throw new BadRequestException("The last slab must be open-ended (to = null)");
            r.setSlabs(mapper.writeValueAsString(req.slabs()));
            r.setSectionLimits(mapper.writeValueAsString(req.sectionLimits() == null ? Map.of() : req.sectionLimits()));
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Invalid slab configuration");
        }
        r.setStandardDeduction(req.standardDeduction());
        r.setCessPercent(req.cessPercent());
        r.setRebateLimit(req.rebateLimit());
        r.setRebateAmount(req.rebateAmount());
        if (req.active() != null) r.setActive(req.active());
    }

    private RuleResponse toResponse(TaxRule r) {
        try {
            return new RuleResponse(r.getId(), r.getFinancialYear(), r.getRegime().name(), mapper.readValue(r.getSlabs(), new TypeReference<List<SlabDto>>() { }),
                    mapper.readValue(r.getSectionLimits(), new TypeReference<Map<String, java.math.BigDecimal>>() { }), r.getStandardDeduction(), r.getCessPercent(),
                    r.getRebateLimit(), r.getRebateAmount(), r.isActive());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Corrupt tax rule " + r.getId(), e);
        }
    }
}
