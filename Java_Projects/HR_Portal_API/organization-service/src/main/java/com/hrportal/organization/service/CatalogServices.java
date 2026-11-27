package com.hrportal.organization.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.CacheEvictor;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.persistence.CrudService;
import com.hrportal.organization.dto.OrgDtos.BusinessUnitRequest;
import com.hrportal.organization.dto.OrgDtos.BusinessUnitResponse;
import com.hrportal.organization.dto.OrgDtos.DepartmentRequest;
import com.hrportal.organization.dto.OrgDtos.DepartmentResponse;
import com.hrportal.organization.dto.OrgDtos.DesignationRequest;
import com.hrportal.organization.dto.OrgDtos.DesignationResponse;
import com.hrportal.organization.dto.OrgDtos.JobGradeRequest;
import com.hrportal.organization.dto.OrgDtos.JobGradeResponse;
import com.hrportal.organization.dto.OrgDtos.LocationRequest;
import com.hrportal.organization.dto.OrgDtos.LocationResponse;
import com.hrportal.organization.dto.OrgDtos.OrganizationRequest;
import com.hrportal.organization.dto.OrgDtos.OrganizationResponse;
import com.hrportal.organization.entity.BusinessUnit;
import com.hrportal.organization.entity.Department;
import com.hrportal.organization.entity.Designation;
import com.hrportal.organization.entity.JobGrade;
import com.hrportal.organization.entity.Location;
import com.hrportal.organization.entity.Organization;
import com.hrportal.organization.repository.BusinessUnitRepository;
import com.hrportal.organization.repository.DepartmentRepository;
import com.hrportal.organization.repository.DesignationRepository;
import com.hrportal.organization.repository.JobGradeRepository;
import com.hrportal.organization.repository.LocationRepository;
import com.hrportal.organization.repository.OrganizationRepository;

/**
 * Master-data services. They share {@link CrudService}; each adds only its own rule and cache handling.
 * Reads of a single record are cached in Redis (cache name = resource, key = id) and evicted on every write.
 */
public final class CatalogServices {
    private CatalogServices() {
    }

    @Service
    public static class OrganizationService extends CrudService<Organization, OrganizationRequest, OrganizationResponse> {
        public OrganizationService(OrganizationRepository repo, AuditService audit) {
            super(repo, audit, Organization.class, OrganizationResponse.class);
        }
    }

    @Service
    public static class BusinessUnitService extends CrudService<BusinessUnit, BusinessUnitRequest, BusinessUnitResponse> {
        private final OrganizationRepository organizations;

        public BusinessUnitService(BusinessUnitRepository repo, AuditService audit, OrganizationRepository organizations) {
            super(repo, audit, BusinessUnit.class, BusinessUnitResponse.class);
            this.organizations = organizations;
        }

        @Override
        protected void beforeCreate(BusinessUnit e, BusinessUnitRequest r) {
            if (!organizations.existsById(r.organizationId())) throw new BadRequestException("Unknown organization: " + r.organizationId());
        }
    }

    @Service
    public static class DepartmentService extends CrudService<Department, DepartmentRequest, DepartmentResponse> {
        private final DepartmentRepository departments;
        private final CacheEvictor cache;

        public DepartmentService(DepartmentRepository repo, AuditService audit, CacheEvictor cache) {
            super(repo, audit, Department.class, DepartmentResponse.class);
            this.departments = repo;
            this.cache = cache;
        }

        @Override
        @Cacheable(cacheNames = "departments", key = "#id")
        public DepartmentResponse get(String id) {
            return super.get(id);
        }

        @Override
        protected void beforeCreate(Department e, DepartmentRequest r) {
            checkParent(null, r.parentId());
        }

        @Override
        protected void beforeUpdate(Department e, DepartmentRequest r) {
            checkParent(e.getId(), e.getParentId());
        }

        /** The parent must exist and following the parent links upwards must never lead back to this department. */
        private void checkParent(String selfId, String parentId) {
            String cursor = parentId;
            int guard = 0;
            while (cursor != null && guard++ < 50) {
                if (cursor.equals(selfId)) throw new BadRequestException("A department cannot be its own ancestor");
                String current = cursor;
                Department p = departments.findById(current).orElseThrow(() -> new BadRequestException("Unknown parent department: " + current));
                cursor = p.getParentId();
            }
        }

        @Override
        protected void afterSave(Department e) {
            cache.evict("departments", e.getId());
            cache.clear("orgChart", "departmentTree");
        }
    }

    @Service
    public static class JobGradeService extends CrudService<JobGrade, JobGradeRequest, JobGradeResponse> {
        public JobGradeService(JobGradeRepository repo, AuditService audit) {
            super(repo, audit, JobGrade.class, JobGradeResponse.class);
        }

        @Override
        protected void beforeCreate(JobGrade e, JobGradeRequest r) {
            check(r);
        }

        @Override
        protected void beforeUpdate(JobGrade e, JobGradeRequest r) {
            if (e.getMinSalary() != null && e.getMaxSalary() != null && e.getMinSalary().compareTo(e.getMaxSalary()) > 0) {
                throw new BadRequestException("minSalary cannot exceed maxSalary");
            }
        }

        private void check(JobGradeRequest r) {
            if (r.level() == null) throw new BadRequestException("level is required");
            if (r.minSalary() != null && r.maxSalary() != null && r.minSalary().compareTo(r.maxSalary()) > 0) {
                throw new BadRequestException("minSalary cannot exceed maxSalary");
            }
        }
    }

    @Service
    public static class DesignationService extends CrudService<Designation, DesignationRequest, DesignationResponse> {
        private final CacheEvictor cache;

        public DesignationService(DesignationRepository repo, AuditService audit, CacheEvictor cache) {
            super(repo, audit, Designation.class, DesignationResponse.class);
            this.cache = cache;
        }

        @Override
        @Cacheable(cacheNames = "designations", key = "#id")
        public DesignationResponse get(String id) {
            return super.get(id);
        }

        @Override
        protected void afterSave(Designation e) {
            cache.evict("designations", e.getId());
            cache.clear("orgChart");
        }
    }

    @Service
    public static class LocationService extends CrudService<Location, LocationRequest, LocationResponse> {
        private final CacheEvictor cache;

        public LocationService(LocationRepository repo, AuditService audit, CacheEvictor cache) {
            super(repo, audit, Location.class, LocationResponse.class);
            this.cache = cache;
        }

        @Override
        @Cacheable(cacheNames = "locations", key = "#id")
        public LocationResponse get(String id) {
            return super.get(id);
        }

        @Override
        protected void afterSave(Location e) {
            cache.evict("locations", e.getId());
        }
    }
}
