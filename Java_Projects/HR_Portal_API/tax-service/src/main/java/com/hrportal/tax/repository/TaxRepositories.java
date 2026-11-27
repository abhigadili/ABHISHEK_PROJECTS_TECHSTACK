package com.hrportal.tax.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.tax.entity.Enums.DeclarationStatus;
import com.hrportal.tax.entity.Enums.Regime;
import com.hrportal.tax.entity.InvestmentDeclaration;
import com.hrportal.tax.entity.MonthlyTds;
import com.hrportal.tax.entity.TaxComputation;
import com.hrportal.tax.entity.TaxDeclaration;
import com.hrportal.tax.entity.TaxDeclarationHistory;
import com.hrportal.tax.entity.TaxDocument;
import com.hrportal.tax.entity.TaxEmployee;
import com.hrportal.tax.entity.TaxProof;
import com.hrportal.tax.entity.TaxRule;

public final class TaxRepositories {
    private TaxRepositories() {
    }

    public interface RuleRepository extends JpaRepository<TaxRule, String> {
        Optional<TaxRule> findByFinancialYearAndRegimeAndActiveTrue(String financialYear, Regime regime);

        List<TaxRule> findByFinancialYearOrderByRegime(String financialYear);

        boolean existsByFinancialYearAndRegime(String financialYear, Regime regime);
    }

    public interface DeclarationRepository extends JpaRepository<TaxDeclaration, String> {
        Optional<TaxDeclaration> findByEmployeeIdAndFinancialYear(String employeeId, String financialYear);

        List<TaxDeclaration> findByEmployeeIdOrderByFinancialYearDesc(String employeeId);

        List<TaxDeclaration> findByStatusInOrderBySubmittedAtAsc(Collection<DeclarationStatus> statuses);

        @Query("select d.status as status, count(d) as cnt from TaxDeclaration d where d.financialYear = :fy group by d.status")
        List<StatusCount> countByStatus(@Param("fy") String fy);

        interface StatusCount {
            DeclarationStatus getStatus();

            long getCnt();
        }
    }

    public interface InvestmentRepository extends JpaRepository<InvestmentDeclaration, String> {
        List<InvestmentDeclaration> findByDeclarationIdOrderBySectionAsc(String declarationId);

        @Modifying
        @Query("delete from InvestmentDeclaration i where i.declarationId = :declarationId")
        int deleteByDeclarationId(@Param("declarationId") String declarationId);
    }

    public interface ProofRepository extends JpaRepository<TaxProof, String> {
        List<TaxProof> findByDeclarationIdOrderByCreatedAtAsc(String declarationId);

        List<TaxProof> findByInvestmentIdOrderByAttemptNumberAsc(String investmentId);

        @Query("select p from TaxProof p where p.status = com.hrportal.tax.entity.Enums$ProofStatus.SUBMITTED order by p.createdAt")
        List<TaxProof> findAwaitingReview();
    }

    public interface HistoryRepository extends JpaRepository<TaxDeclarationHistory, String> {
        List<TaxDeclarationHistory> findByDeclarationIdOrderByCreatedAtAsc(String declarationId);
    }

    public interface ComputationRepository extends JpaRepository<TaxComputation, String> {
        Optional<TaxComputation> findByEmployeeIdAndFinancialYear(String employeeId, String financialYear);
    }

    public interface MonthlyTdsRepository extends JpaRepository<MonthlyTds, String> {
        Optional<MonthlyTds> findByEmployeeIdAndTdsMonth(String employeeId, String tdsMonth);

        List<MonthlyTds> findByEmployeeIdAndFinancialYearOrderByTdsMonth(String employeeId, String financialYear);
    }

    public interface DocumentRepository extends JpaRepository<TaxDocument, String> {
        List<TaxDocument> findByEmployeeIdOrderByFinancialYearDescCreatedAtDesc(String employeeId);

        List<TaxDocument> findByEmployeeIdAndFinancialYearOrderByCreatedAtDesc(String employeeId, String financialYear);
    }

    public interface TaxEmployeeRepository extends JpaRepository<TaxEmployee, String> {
        List<TaxEmployee> findByStatusIn(Collection<String> statuses);
    }
}
