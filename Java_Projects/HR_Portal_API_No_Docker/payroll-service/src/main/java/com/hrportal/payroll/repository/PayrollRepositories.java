package com.hrportal.payroll.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.payroll.entity.Adjustment;
import com.hrportal.payroll.entity.EmployeeSalary;
import com.hrportal.payroll.entity.Enums.AdjustmentStatus;
import com.hrportal.payroll.entity.Enums.LoanStatus;
import com.hrportal.payroll.entity.Enums.RevisionStatus;
import com.hrportal.payroll.entity.Enums.SalaryStatus;
import com.hrportal.payroll.entity.Loan;
import com.hrportal.payroll.entity.LoanDeduction;
import com.hrportal.payroll.entity.PayrollConfig;
import com.hrportal.payroll.entity.PayrollEntry;
import com.hrportal.payroll.entity.PayrollEntryLine;
import com.hrportal.payroll.entity.PayrollRun;
import com.hrportal.payroll.entity.Payslip;
import com.hrportal.payroll.entity.SalaryComponent;
import com.hrportal.payroll.entity.SalaryRevision;
import com.hrportal.payroll.entity.SalaryRevisionHistory;
import com.hrportal.payroll.entity.SalaryStructure;
import com.hrportal.payroll.entity.SalaryStructureComponent;

public final class PayrollRepositories {
    private PayrollRepositories() {
    }

    public interface ComponentRepository extends JpaRepository<SalaryComponent, String> {
        Optional<SalaryComponent> findByCodeIgnoreCase(String code);

        List<SalaryComponent> findByActiveTrueOrderByDisplayOrderAsc();
    }

    public interface StructureRepository extends JpaRepository<SalaryStructure, String> {
    }

    public interface StructureComponentRepository extends JpaRepository<SalaryStructureComponent, String> {
        List<SalaryStructureComponent> findByStructureId(String structureId);

        List<SalaryStructureComponent> findByStructureIdIn(Collection<String> structureIds);

        @Modifying
        @Query("delete from SalaryStructureComponent c where c.structureId = :structureId")
        int deleteByStructureId(@Param("structureId") String structureId);
    }

    public interface EmployeeSalaryRepository extends JpaRepository<EmployeeSalary, String> {
        Optional<EmployeeSalary> findFirstByEmployeeIdAndStatusOrderByEffectiveFromDesc(String employeeId, SalaryStatus status);

        List<EmployeeSalary> findByEmployeeIdOrderByEffectiveFromDesc(String employeeId);

        /** Salaries in force at any time during the month (the payroll population). */
        @Query("select s from EmployeeSalary s where s.status = com.hrportal.payroll.entity.Enums$SalaryStatus.ACTIVE and s.effectiveFrom <= :monthEnd "
                + "and (s.effectiveTo is null or s.effectiveTo >= :monthStart) order by s.employeeId")
        List<EmployeeSalary> findInForce(@Param("monthStart") LocalDate monthStart, @Param("monthEnd") LocalDate monthEnd);

        boolean existsByStructureId(String structureId);
    }

    public interface RevisionRepository extends JpaRepository<SalaryRevision, String> {
        List<SalaryRevision> findByStatusOrderByCreatedAtAsc(RevisionStatus status);

        List<SalaryRevision> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

        boolean existsByEmployeeIdAndStatus(String employeeId, RevisionStatus status);
    }

    public interface RevisionHistoryRepository extends JpaRepository<SalaryRevisionHistory, Long> {
        List<SalaryRevisionHistory> findByEmployeeIdOrderByChangedAtDesc(String employeeId);
    }

    public interface ConfigRepository extends JpaRepository<PayrollConfig, String> {
        Optional<PayrollConfig> findByConfigKey(String key);
    }

    public interface RunRepository extends JpaRepository<PayrollRun, String> {
        Optional<PayrollRun> findByPayrollMonth(String month);

        Page<PayrollRun> findAllByOrderByPayrollMonthDesc(Pageable pageable);
    }

    public interface EntryRepository extends JpaRepository<PayrollEntry, String> {
        Page<PayrollEntry> findByRunId(String runId, Pageable pageable);

        List<PayrollEntry> findByRunId(String runId);

        Optional<PayrollEntry> findByRunIdAndEmployeeId(String runId, String employeeId);

        @Query("select e from PayrollEntry e join PayrollRun r on r.id = e.runId where e.employeeId = :employeeId and r.status = com.hrportal.payroll.entity.Enums$RunStatus.FINALIZED "
                + "and e.payrollMonth between :fromMonth and :toMonth order by e.payrollMonth")
        List<PayrollEntry> findFinalizedForEmployee(@Param("employeeId") String employeeId, @Param("fromMonth") String fromMonth, @Param("toMonth") String toMonth);

        @Modifying
        @Query("delete from PayrollEntry e where e.runId = :runId")
        int deleteByRunId(@Param("runId") String runId);
    }

    public interface LineRepository extends JpaRepository<PayrollEntryLine, String> {
        List<PayrollEntryLine> findByEntryIdIn(Collection<String> entryIds);

        List<PayrollEntryLine> findByEntryId(String entryId);

        @Modifying
        @Query("delete from PayrollEntryLine l where l.entryId in (select e.id from PayrollEntry e where e.runId = :runId)")
        int deleteByRunId(@Param("runId") String runId);
    }

    public interface AdjustmentRepository extends JpaRepository<Adjustment, String> {
        List<Adjustment> findByEmployeeIdAndPayrollMonthAndStatus(String employeeId, String month, AdjustmentStatus status);

        @Query("select a from Adjustment a where a.payrollMonth = :month and a.status = com.hrportal.payroll.entity.Enums$AdjustmentStatus.PENDING")
        List<Adjustment> findPendingForMonth(@Param("month") String month);

        Page<Adjustment> findByPayrollMonth(String month, Pageable pageable);

        Page<Adjustment> findByEmployeeId(String employeeId, Pageable pageable);
    }

    public interface LoanRepository extends JpaRepository<Loan, String> {
        List<Loan> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

        @Query("select l from Loan l where l.status = com.hrportal.payroll.entity.Enums$LoanStatus.ACTIVE and l.startMonth <= :month")
        List<Loan> findActiveStartedBy(@Param("month") String month);

        List<Loan> findByEmployeeIdAndStatus(String employeeId, LoanStatus status);
    }

    public interface LoanDeductionRepository extends JpaRepository<LoanDeduction, String> {
        @Modifying
        @Query("delete from LoanDeduction d where d.runId = :runId")
        int deleteByRunId(@Param("runId") String runId);
    }

    public interface PayslipRepository extends JpaRepository<Payslip, String> {
        List<Payslip> findByEmployeeIdOrderByPayrollMonthDesc(String employeeId);

        Optional<Payslip> findByEntryId(String entryId);

        List<Payslip> findByRunId(String runId);
    }
}
