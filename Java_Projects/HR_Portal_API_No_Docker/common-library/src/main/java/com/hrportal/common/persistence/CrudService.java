package com.hrportal.common.persistence;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.ResourceNotFoundException;

/**
 * Reusable service skeleton for master-data style resources (types, categories, templates ...): create / read /
 * update (partial, null-safe) / delete (soft delete when the entity supports it), all audited. Subclasses add
 * uniqueness rules or side effects through the {@code before*} / {@code after*} hooks - the business rules stay in
 * the service layer, never in controllers.
 *
 * @param <E> entity, @param <Q> request record, @param <R> response record
 */
@Transactional
public abstract class CrudService<E extends BaseEntity, Q, R> {
    protected final JpaRepository<E, String> repository;
    protected final AuditService audit;
    private final Class<E> entityType;
    private final Class<R> responseType;
    private final String entityName;

    protected CrudService(JpaRepository<E, String> repository, AuditService audit, Class<E> entityType, Class<R> responseType) {
        this.repository = repository;
        this.audit = audit;
        this.entityType = entityType;
        this.responseType = responseType;
        this.entityName = entityType.getSimpleName();
    }

    @Transactional(readOnly = true)
    public Page<R> page(Pageable pageable) {
        return repository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<R> all() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public R get(String id) {
        return toResponse(find(id));
    }

    public E find(String id) {
        return repository.findById(id).orElseThrow(() -> ResourceNotFoundException.of(entityName, id));
    }

    public R create(Q request) {
        E entity = BeanMapper.toEntity(request, entityType);
        beforeCreate(entity, request);
        E saved = repository.save(entity);
        afterSave(saved);
        R response = toResponse(saved);
        audit.record(entityName, saved.getId(), "CREATED", response);
        return response;
    }

    public R update(String id, Q request) {
        E entity = find(id);
        R before = toResponse(entity);
        BeanMapper.copyNonNull(request, entity);
        beforeUpdate(entity, request);
        E saved = repository.save(entity);
        afterSave(saved);
        R after = toResponse(saved);
        audit.record(entityName, id, "UPDATED", before, after);
        return after;
    }

    public void delete(String id) {
        E entity = find(id);
        beforeDelete(entity);
        R before = toResponse(entity);
        if (entity instanceof SoftDeletableEntity soft) {
            soft.markDeleted();
            repository.save(entity);
        } else {
            repository.delete(entity);
        }
        afterSave(entity);
        audit.record(entityName, id, "DELETED", before, null);
    }

    protected R toResponse(E entity) {
        return BeanMapper.toRecord(entity, responseType);
    }

    protected void beforeCreate(E entity, Q request) { }

    protected void beforeUpdate(E entity, Q request) { }

    protected void beforeDelete(E entity) { }

    /** Hook for cache eviction / event publication after any write. */
    protected void afterSave(E entity) { }
}
