package com.hrportal.reporting.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.reporting.entity.ReportFact;
import com.hrportal.reporting.entity.RptEmployee;

public final class ReportingRepositories {
    private ReportingRepositories() {
    }

    public interface EmployeeRepository extends JpaRepository<RptEmployee, String> {
        @Query("select e.departmentId as key, e.status as status, count(e) as cnt from RptEmployee e group by e.departmentId, e.status")
        List<GroupCount> headcountByDepartment();

        @Query("select e.locationId as key, e.status as status, count(e) as cnt from RptEmployee e group by e.locationId, e.status")
        List<GroupCount> headcountByLocation();

        interface GroupCount {
            String getKey();

            String getStatus();

            long getCnt();
        }
    }

    public interface FactRepository extends JpaRepository<ReportFact, String> {
        Optional<ReportFact> findByFactTypeAndSubjectKey(String factType, String subjectKey);

        List<ReportFact> findByFactType(String factType);

        List<ReportFact> findByFactTypeAndPeriodKey(String factType, String periodKey);

        List<ReportFact> findByFactTypeAndPeriodKeyStartingWith(String factType, String periodPrefix);

        @Query("select f from ReportFact f where f.factType = :type and f.dateA between :from and :to")
        List<ReportFact> findByTypeAndDateA(@Param("type") String type, @Param("from") java.time.LocalDate from, @Param("to") java.time.LocalDate to);
    }
}
