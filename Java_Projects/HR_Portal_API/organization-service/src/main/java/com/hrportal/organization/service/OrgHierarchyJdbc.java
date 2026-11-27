package com.hrportal.organization.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.hrportal.organization.dto.OrgDtos.ChainLink;
import com.hrportal.organization.dto.OrgDtos.DepartmentHeadcount;

/**
 * Hierarchy queries that are natural in SQL: RECURSIVE CTEs walk the reporting line up / down, and a window function
 * ranks departments by size. Uses NamedParameterJdbcTemplate (named, bound parameters - never string concatenation)
 * with a {@link RowMapper} and a ResultSetExtractor.
 */
@Repository
public class OrgHierarchyJdbc {
    private static final RowMapper<ChainLink> CHAIN_MAPPER = (rs, i) ->
            new ChainLink(rs.getString("employee_id"), rs.getString("full_name"), rs.getString("manager_id"), rs.getInt("lvl"));

    private final NamedParameterJdbcTemplate jdbc;

    public OrgHierarchyJdbc(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The employee, their manager, the manager's manager ... up to the top (level 0 = the employee). */
    public List<ChainLink> reportingChain(String employeeId) {
        String sql = """
                WITH RECURSIVE chain AS (
                  SELECT employee_id, full_name, manager_id, 0 AS lvl FROM org_employee_nodes WHERE employee_id = :id
                  UNION ALL
                  SELECT n.employee_id, n.full_name, n.manager_id, c.lvl + 1
                  FROM org_employee_nodes n JOIN chain c ON n.employee_id = c.manager_id WHERE c.lvl < 25
                ) SELECT employee_id, full_name, manager_id, lvl FROM chain ORDER BY lvl
                """;
        return jdbc.query(sql, new MapSqlParameterSource("id", employeeId), CHAIN_MAPPER);
    }

    /** Everybody below the employee (direct and indirect reports) down to {@code maxDepth} levels. */
    public List<ChainLink> subordinates(String employeeId, int maxDepth) {
        String sql = """
                WITH RECURSIVE tree AS (
                  SELECT employee_id, full_name, manager_id, 1 AS lvl FROM org_employee_nodes WHERE manager_id = :id
                  UNION ALL
                  SELECT n.employee_id, n.full_name, n.manager_id, t.lvl + 1
                  FROM org_employee_nodes n JOIN tree t ON n.manager_id = t.employee_id WHERE t.lvl < :maxDepth
                ) SELECT employee_id, full_name, manager_id, lvl FROM tree ORDER BY lvl, full_name
                """;
        return jdbc.query(sql, new MapSqlParameterSource("id", employeeId).addValue("maxDepth", maxDepth), CHAIN_MAPPER);
    }

    /** Headcount per department with a RANK() window function; ResultSetExtractor builds an ordered list. */
    public List<DepartmentHeadcount> headcountByDepartment() {
        String sql = """
                SELECT d.id AS dept_id, d.name AS dept_name, COUNT(n.employee_id) AS headcount,
                       RANK() OVER (ORDER BY COUNT(n.employee_id) DESC) AS size_rank
                FROM departments d
                LEFT JOIN org_employee_nodes n ON n.department_id = d.id AND n.status NOT IN ('RESIGNED', 'TERMINATED')
                WHERE d.deleted = 0
                GROUP BY d.id, d.name ORDER BY size_rank, d.name
                """;
        return jdbc.query(sql, rs -> {
            List<DepartmentHeadcount> out = new ArrayList<>();
            while (rs.next()) {
                out.add(new DepartmentHeadcount(rs.getString("dept_id"), rs.getString("dept_name"), rs.getLong("headcount"), rs.getLong("size_rank")));
            }
            return out;
        });
    }

    /** Active headcount by department id (used to annotate the department tree). */
    public Map<String, Long> activeCountsByDepartment() {
        return jdbc.query("SELECT department_id, COUNT(*) c FROM org_employee_nodes WHERE status NOT IN ('RESIGNED','TERMINATED') AND department_id IS NOT NULL GROUP BY department_id",
                rs -> {
                    Map<String, Long> m = new LinkedHashMap<>();
                    while (rs.next()) m.put(rs.getString(1), rs.getLong(2));
                    return m;
                });
    }
}
