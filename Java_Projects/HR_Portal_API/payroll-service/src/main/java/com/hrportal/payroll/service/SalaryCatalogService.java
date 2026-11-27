package com.hrportal.payroll.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.persistence.CrudService;
import com.hrportal.payroll.dto.PayrollDtos.ComponentRequest;
import com.hrportal.payroll.dto.PayrollDtos.ComponentResponse;
import com.hrportal.payroll.dto.PayrollDtos.StructureLine;
import com.hrportal.payroll.dto.PayrollDtos.StructureLineResponse;
import com.hrportal.payroll.dto.PayrollDtos.StructureRequest;
import com.hrportal.payroll.dto.PayrollDtos.StructureResponse;
import com.hrportal.payroll.entity.SalaryComponent;
import com.hrportal.payroll.entity.SalaryStructure;
import com.hrportal.payroll.entity.SalaryStructureComponent;
import com.hrportal.payroll.repository.PayrollRepositories.ComponentRepository;
import com.hrportal.payroll.repository.PayrollRepositories.EmployeeSalaryRepository;
import com.hrportal.payroll.repository.PayrollRepositories.StructureComponentRepository;
import com.hrportal.payroll.repository.PayrollRepositories.StructureRepository;

/** Salary components (earnings / deductions) and salary structures (component bundles with values). */
public final class SalaryCatalogService {
    private SalaryCatalogService() {
    }

    @Service
    public static class ComponentService extends CrudService<SalaryComponent, ComponentRequest, ComponentResponse> {
        private final ComponentRepository components;

        public ComponentService(ComponentRepository components, AuditService audit) {
            super(components, audit, SalaryComponent.class, ComponentResponse.class);
            this.components = components;
        }

        @Override
        protected void beforeCreate(SalaryComponent c, ComponentRequest r) {
            if (components.findByCodeIgnoreCase(r.code()).isPresent()) throw new ConflictException("Component code already exists: " + r.code());
        }

        @Transactional(readOnly = true)
        public List<ComponentResponse> active() {
            return BeanMapper.toRecords(components.findByActiveTrueOrderByDisplayOrderAsc(), ComponentResponse.class);
        }
    }

    @Service
    @Transactional
    public static class StructureService {
        private final StructureRepository structures;
        private final StructureComponentRepository lines;
        private final ComponentRepository components;
        private final EmployeeSalaryRepository salaries;
        private final AuditService audit;

        public StructureService(StructureRepository structures, StructureComponentRepository lines, ComponentRepository components,
                                EmployeeSalaryRepository salaries, AuditService audit) {
            this.structures = structures;
            this.lines = lines;
            this.components = components;
            this.salaries = salaries;
            this.audit = audit;
        }

        public StructureResponse create(StructureRequest req) {
            SalaryStructure s = new SalaryStructure();
            s.setName(req.name());
            s.setDescription(req.description());
            if (req.active() != null) s.setActive(req.active());
            s = structures.save(s);
            replaceLines(s.getId(), req.components());
            audit.record("SalaryStructure", s.getId(), "CREATED", req.name());
            return get(s.getId());
        }

        public StructureResponse update(String id, StructureRequest req) {
            SalaryStructure s = structures.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Salary structure", id));
            s.setName(req.name());
            s.setDescription(req.description());
            if (req.active() != null) s.setActive(req.active());
            structures.save(s);
            replaceLines(id, req.components());
            audit.record("SalaryStructure", id, "UPDATED", req.name());
            return get(id);
        }

        public void delete(String id) {
            SalaryStructure s = structures.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Salary structure", id));
            if (salaries.existsByStructureId(id)) throw new BadRequestException("The structure is assigned to employees - deactivate it instead");
            s.markDeleted();
            structures.save(s);
            audit.record("SalaryStructure", id, "DELETED", s.getName());
        }

        @Transactional(readOnly = true)
        public StructureResponse get(String id) {
            SalaryStructure s = structures.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Salary structure", id));
            return toResponse(s, lines.findByStructureId(id));
        }

        @Transactional(readOnly = true)
        public List<StructureResponse> list() {
            List<SalaryStructure> all = structures.findAll();
            Map<String, List<SalaryStructureComponent>> byStructure = lines.findByStructureIdIn(all.stream().map(SalaryStructure::getId).toList()).stream()
                    .collect(Collectors.groupingBy(SalaryStructureComponent::getStructureId));
            return all.stream().map(s -> toResponse(s, byStructure.getOrDefault(s.getId(), List.of()))).toList();
        }

        private void replaceLines(String structureId, List<StructureLine> requested) {
            Map<String, SalaryComponent> byId = components.findAllById(requested.stream().map(StructureLine::componentId).toList()).stream()
                    .collect(Collectors.toMap(SalaryComponent::getId, Function.identity()));
            Map<String, Boolean> seen = new HashMap<>();
            boolean hasBasic = false;
            for (StructureLine l : requested) {
                SalaryComponent c = byId.get(l.componentId());
                if (c == null) throw new BadRequestException("Unknown component: " + l.componentId());
                if (seen.put(c.getId(), true) != null) throw new BadRequestException("Component listed twice: " + c.getCode());
                hasBasic |= "BASIC".equals(c.getCode());
            }
            if (!hasBasic) throw new BadRequestException("A structure must contain the BASIC component");
            lines.deleteByStructureId(structureId);
            lines.flush();
            for (StructureLine l : requested) {
                SalaryStructureComponent x = new SalaryStructureComponent();
                x.setStructureId(structureId);
                x.setComponentId(l.componentId());
                x.setValue(l.value());
                lines.save(x);
            }
        }

        private StructureResponse toResponse(SalaryStructure s, List<SalaryStructureComponent> ls) {
            Map<String, SalaryComponent> byId = components.findAllById(ls.stream().map(SalaryStructureComponent::getComponentId).toList()).stream()
                    .collect(Collectors.toMap(SalaryComponent::getId, Function.identity()));
            List<StructureLineResponse> out = ls.stream().filter(l -> byId.containsKey(l.getComponentId())).map(l -> {
                SalaryComponent c = byId.get(l.getComponentId());
                return new StructureLineResponse(c.getId(), c.getCode(), c.getName(), c.getType().name(), c.getCalcType().name(), l.getValue());
            }).sorted(java.util.Comparator.comparing(StructureLineResponse::componentCode)).toList();
            return new StructureResponse(s.getId(), s.getName(), s.getDescription(), s.isActive(), out);
        }
    }
}
