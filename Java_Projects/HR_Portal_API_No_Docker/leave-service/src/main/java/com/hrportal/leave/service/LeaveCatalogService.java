package com.hrportal.leave.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.CacheEvictor;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.persistence.CrudService;
import com.hrportal.leave.dto.LeaveDtos.EntitlementDto;
import com.hrportal.leave.dto.LeaveDtos.LeaveTypeRequest;
import com.hrportal.leave.dto.LeaveDtos.LeaveTypeResponse;
import com.hrportal.leave.dto.LeaveDtos.PolicyRequest;
import com.hrportal.leave.dto.LeaveDtos.PolicyResponse;
import com.hrportal.leave.entity.LeavePolicy;
import com.hrportal.leave.entity.LeavePolicyEntitlement;
import com.hrportal.leave.entity.LeaveType;
import com.hrportal.leave.repository.LeaveRepositories.EntitlementRepository;
import com.hrportal.leave.repository.LeaveRepositories.LeavePolicyRepository;
import com.hrportal.leave.repository.LeaveRepositories.LeaveTypeRepository;

/** Leave types and leave policies (master data, Redis-cached, audited). */
public final class LeaveCatalogService {
    private LeaveCatalogService() {
    }

    @Service
    public static class LeaveTypeService extends CrudService<LeaveType, LeaveTypeRequest, LeaveTypeResponse> {
        private final LeaveTypeRepository types;
        private final CacheEvictor cache;

        public LeaveTypeService(LeaveTypeRepository repo, AuditService audit, CacheEvictor cache) {
            super(repo, audit, LeaveType.class, LeaveTypeResponse.class);
            this.types = repo;
            this.cache = cache;
        }

        @Cacheable(cacheNames = "leaveTypes", key = "'all'")
        @Transactional(readOnly = true)
        public List<LeaveTypeResponse> activeTypes() {
            return types.findByActiveTrueOrderByName().stream().map(this::toResponse).toList();
        }

        public Map<String, LeaveTypeResponse> byId() {
            Map<String, LeaveTypeResponse> m = new HashMap<>();
            activeTypes().forEach(t -> m.put(t.id(), t));
            return m;
        }

        @Override
        protected void beforeCreate(LeaveType t, LeaveTypeRequest r) {
            if (types.findByCodeIgnoreCase(r.code()).isPresent()) throw new BadRequestException("Leave type code already exists: " + r.code());
            t.setCode(r.code().toUpperCase());
        }

        @Override
        protected void afterSave(LeaveType t) {
            cache.clear("leaveTypes", "leaveBalance");
        }
    }

    @Service
    public static class LeavePolicyService {
        private final LeavePolicyRepository policies;
        private final EntitlementRepository entitlements;
        private final LeaveTypeRepository types;
        private final AuditService audit;
        private final CacheEvictor cache;

        public LeavePolicyService(LeavePolicyRepository policies, EntitlementRepository entitlements, LeaveTypeRepository types,
                                  AuditService audit, CacheEvictor cache) {
            this.policies = policies;
            this.entitlements = entitlements;
            this.types = types;
            this.audit = audit;
            this.cache = cache;
        }

        @Transactional(readOnly = true)
        public List<PolicyResponse> list() {
            return policies.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
        }

        @Transactional(readOnly = true)
        public PolicyResponse get(String id) {
            return toResponse(policies.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Leave policy", id)));
        }

        /** The policy used for entitlements and the HR-approval threshold. */
        @Cacheable(cacheNames = "leavePolicy", key = "'default'")
        @Transactional(readOnly = true)
        public PolicyResponse defaultPolicy() {
            return toResponse(policies.findFirstByDefaultPolicyTrueAndActiveTrue().orElseThrow(() -> new BadRequestException("No default leave policy configured")));
        }

        @Transactional
        public PolicyResponse create(PolicyRequest req) {
            LeavePolicy p = BeanMapper.toEntity(req, LeavePolicy.class);
            if (p.isDefaultPolicy()) clearDefault(null);
            p = policies.save(p);
            replaceEntitlements(p.getId(), req.rules());
            cache.clear("leavePolicy");
            PolicyResponse r = get(p.getId());
            audit.record("LeavePolicy", p.getId(), "CREATED", r);
            return r;
        }

        @Transactional
        public PolicyResponse update(String id, PolicyRequest req) {
            LeavePolicy p = policies.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Leave policy", id));
            PolicyResponse before = get(id);
            BeanMapper.copyNonNull(req, p);
            if (p.isDefaultPolicy()) clearDefault(id);
            policies.save(p);
            if (req.rules() != null) replaceEntitlements(id, req.rules());
            cache.clear("leavePolicy");
            PolicyResponse after = get(id);
            audit.record("LeavePolicy", id, "UPDATED", before, after);
            return after;
        }

        private void clearDefault(String exceptId) {
            policies.findAll().stream().filter(x -> x.isDefaultPolicy() && !x.getId().equals(exceptId)).forEach(x -> {
                x.setDefaultPolicy(false);
                policies.save(x);
            });
        }

        private void replaceEntitlements(String policyId, List<EntitlementDto> list) {
            if (list == null) return;
            for (EntitlementDto e : list) {
                if (!types.existsById(e.leaveTypeId())) throw new BadRequestException("Unknown leave type: " + e.leaveTypeId());
            }
            entitlements.deleteByPolicyId(policyId);
            entitlements.flush();
            for (EntitlementDto e : list) {
                LeavePolicyEntitlement x = BeanMapper.toEntity(e, LeavePolicyEntitlement.class);
                x.setPolicyId(policyId);
                entitlements.save(x);
            }
        }

        private PolicyResponse toResponse(LeavePolicy p) {
            List<EntitlementDto> ents = entitlements.findByPolicyId(p.getId()).stream().map(e -> BeanMapper.toRecord(e, EntitlementDto.class)).toList();
            return new PolicyResponse(p.getId(), p.getName(), p.getDescription(), p.isDefaultPolicy(), p.isActive(), p.getHrApprovalThresholdDays(), ents);
        }
    }
}
