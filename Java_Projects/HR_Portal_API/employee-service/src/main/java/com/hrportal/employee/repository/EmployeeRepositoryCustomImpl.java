package com.hrportal.employee.repository;

import java.util.List;

import com.hrportal.employee.dto.EmployeeDtos.DepartmentStatusCount;
import com.hrportal.employee.dto.EmployeeDtos.ManagerSpan;
import com.hrportal.employee.entity.Employee;
import com.hrportal.employee.entity.Enums.EmployeeStatus;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Root;

/** EntityManager + CriteriaBuilder: group-by queries built programmatically (no strings, no injection surface). */
public class EmployeeRepositoryCustomImpl implements EmployeeRepositoryCustom {
    @PersistenceContext
    private EntityManager em;

    @Override
    public List<DepartmentStatusCount> headcountByDepartmentAndStatus() {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> q = cb.createTupleQuery();
        Root<Employee> e = q.from(Employee.class);
        Expression<Long> count = cb.count(e);
        q.multiselect(e.get("departmentId").alias("departmentId"), e.get("status").alias("status"), count.alias("cnt"))
                .groupBy(e.get("departmentId"), e.get("status"))
                .orderBy(cb.asc(e.get("departmentId")), cb.desc(count));
        return em.createQuery(q).getResultList().stream()
                .map(t -> new DepartmentStatusCount(t.get("departmentId", String.class), t.get("status", EmployeeStatus.class).name(), t.get("cnt", Long.class)))
                .toList();
    }

    @Override
    public List<ManagerSpan> topManagersBySpan(int limit) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> q = cb.createTupleQuery();
        Root<Employee> e = q.from(Employee.class);
        Expression<Long> count = cb.count(e);
        q.multiselect(e.get("managerId").alias("managerId"), count.alias("cnt"))
                .where(cb.isNotNull(e.get("managerId")), cb.equal(e.get("status"), EmployeeStatus.ACTIVE))
                .groupBy(e.get("managerId")).orderBy(cb.desc(count));
        return em.createQuery(q).setMaxResults(limit).getResultList().stream()
                .map(t -> new ManagerSpan(t.get("managerId", String.class), t.get("cnt", Long.class))).toList();
    }
}
