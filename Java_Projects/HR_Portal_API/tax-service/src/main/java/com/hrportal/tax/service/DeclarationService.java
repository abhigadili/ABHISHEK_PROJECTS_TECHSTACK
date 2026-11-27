package com.hrportal.tax.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.tax.dto.TaxDtos.DeclarationRequest;
import com.hrportal.tax.dto.TaxDtos.DeclarationResponse;
import com.hrportal.tax.dto.TaxDtos.HistoryResponse;
import com.hrportal.tax.dto.TaxDtos.InvestmentRequest;
import com.hrportal.tax.dto.TaxDtos.InvestmentResponse;
import com.hrportal.tax.dto.TaxDtos.ProofRequest;
import com.hrportal.tax.dto.TaxDtos.ProofResponse;
import com.hrportal.tax.dto.TaxDtos.StatusSummary;
import com.hrportal.tax.entity.Enums.DeclarationStatus;
import com.hrportal.tax.entity.Enums.InvestmentStatus;
import com.hrportal.tax.entity.Enums.ProofStatus;
import com.hrportal.tax.entity.Enums.Regime;
import com.hrportal.tax.entity.InvestmentDeclaration;
import com.hrportal.tax.entity.TaxDeclaration;
import com.hrportal.tax.entity.TaxDeclarationHistory;
import com.hrportal.tax.entity.TaxEmployee;
import com.hrportal.tax.entity.TaxProof;
import com.hrportal.tax.producer.TaxEventProducer;
import com.hrportal.tax.repository.TaxRepositories.DeclarationRepository;
import com.hrportal.tax.repository.TaxRepositories.HistoryRepository;
import com.hrportal.tax.repository.TaxRepositories.InvestmentRepository;
import com.hrportal.tax.repository.TaxRepositories.ProofRepository;
import com.hrportal.tax.repository.TaxRepositories.TaxEmployeeRepository;

/**
 * The declaration workflow: 1) employee drafts and submits, 2) HR / finance review (start review, approve or reject with a comment),
 * 3) employee uploads supporting proofs (a rejected proof can be resubmitted), 4) reviewer verifies / rejects each proof,
 * 5) payroll then reads the approved figures through the monthly TDS endpoint.
 */
@Service
@Transactional
public class DeclarationService {
    private final DeclarationRepository declarations;
    private final InvestmentRepository investments;
    private final ProofRepository proofs;
    private final HistoryRepository history;
    private final TaxEmployeeRepository employees;
    private final TaxEventProducer producer;
    private final AuditService audit;

    public DeclarationService(DeclarationRepository declarations, InvestmentRepository investments, ProofRepository proofs, HistoryRepository history,
                              TaxEmployeeRepository employees, TaxEventProducer producer, AuditService audit) {
        this.declarations = declarations;
        this.investments = investments;
        this.proofs = proofs;
        this.history = history;
        this.employees = employees;
        this.producer = producer;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ employee side
    public DeclarationResponse save(DeclarationRequest req) {
        String me = requireEmployee();
        TaxDeclaration d = declarations.findByEmployeeIdAndFinancialYear(me, req.financialYear()).orElseGet(() -> create(me, req));
        if (d.getStatus() != DeclarationStatus.DRAFT && d.getStatus() != DeclarationStatus.REJECTED) throw new ConflictException("The declaration is " + d.getStatus() + " and can no longer be edited");
        d.setRegime(Regime.valueOf(req.regime()));
        replaceInvestments(d, req.investments() == null ? List.of() : req.investments());
        if (d.getStatus() == DeclarationStatus.REJECTED) d.setStatus(DeclarationStatus.DRAFT);
        declarations.save(d);
        log(d, "SAVED", null);
        return toResponse(d);
    }

    public DeclarationResponse submit(String id) {
        TaxDeclaration d = find(id);
        requireOwner(d);
        if (d.getStatus() != DeclarationStatus.DRAFT) throw new BadRequestException("Only a DRAFT declaration can be submitted");
        if (d.getRegime() == Regime.OLD && d.getTotalDeclared().signum() == 0) throw new BadRequestException("The old regime needs at least one investment declaration - choose the new regime or add investments");
        d.setStatus(DeclarationStatus.SUBMITTED);
        d.setSubmittedAt(Instant.now());
        d.setReviewComment(null);
        declarations.save(d);
        log(d, "SUBMITTED", null);
        producer.submitted(d);
        audit.record("TaxDeclaration", id, "SUBMITTED", d.getTotalDeclared());
        return toResponse(d);
    }

    public ProofResponse addProof(String declarationId, String investmentId, ProofRequest req) {
        TaxDeclaration d = find(declarationId);
        requireOwner(d);
        if (d.getStatus() == DeclarationStatus.DRAFT) throw new BadRequestException("Submit the declaration first - proofs are uploaded after submission");
        InvestmentDeclaration inv = investments.findById(investmentId).filter(i -> i.getDeclarationId().equals(declarationId)).orElseThrow(() -> ResourceNotFoundException.of("Investment", investmentId));
        if (inv.getStatus() == InvestmentStatus.VERIFIED) throw new BadRequestException("The investment is already verified");
        List<TaxProof> existing = proofs.findByInvestmentIdOrderByAttemptNumberAsc(investmentId);
        if (existing.stream().anyMatch(p -> p.getStatus() == ProofStatus.SUBMITTED)) throw new ConflictException("A proof for this investment is already waiting for review");
        TaxProof p = new TaxProof();
        p.setInvestmentId(investmentId);
        p.setDeclarationId(declarationId);
        p.setDocumentId(req.documentId());
        p.setFileName(req.fileName());
        p.setAttemptNumber(existing.size() + 1);       // resubmission after a rejection = attempt 2, 3 ...
        p = proofs.save(p);
        inv.setStatus(InvestmentStatus.PROOF_SUBMITTED);
        investments.save(inv);
        log(d, existing.isEmpty() ? "PROOF_SUBMITTED" : "PROOF_RESUBMITTED", inv.getSection());
        return toProof(p);
    }

    // ------------------------------------------------------------------ reviewer side
    public DeclarationResponse startReview(String id) {
        TaxDeclaration d = find(id);
        requireReviewer(d);
        if (d.getStatus() != DeclarationStatus.SUBMITTED) throw new BadRequestException("Only a SUBMITTED declaration can be taken into review");
        d.setStatus(DeclarationStatus.UNDER_REVIEW);
        d.setReviewerId(CurrentUser.employeeId());
        declarations.save(d);
        log(d, "REVIEW_STARTED", null);
        return toResponse(d);
    }

    public DeclarationResponse approve(String id, String comment) {
        TaxDeclaration d = find(id);
        requireReviewer(d);
        if (d.getStatus() != DeclarationStatus.SUBMITTED && d.getStatus() != DeclarationStatus.UNDER_REVIEW) throw new BadRequestException("The declaration is " + d.getStatus());
        d.setStatus(DeclarationStatus.APPROVED);
        decide(d, comment);
        // provisional acceptance: declared amounts count until a proof is verified / rejected
        for (InvestmentDeclaration i : investments.findByDeclarationIdOrderBySectionAsc(id)) {
            if (i.getStatus() == InvestmentStatus.DECLARED || i.getStatus() == InvestmentStatus.PROOF_SUBMITTED) i.setApprovedAmount(i.getDeclaredAmount());
            investments.save(i);
        }
        recomputeApproved(d);
        log(d, "APPROVED", comment);
        producer.reviewed(d, "APPROVED", CurrentUser.employeeId(), comment);
        audit.record("TaxDeclaration", id, "APPROVED", comment);
        return toResponse(d);
    }

    public DeclarationResponse reject(String id, String comment) {
        TaxDeclaration d = find(id);
        requireReviewer(d);
        if (d.getStatus() != DeclarationStatus.SUBMITTED && d.getStatus() != DeclarationStatus.UNDER_REVIEW) throw new BadRequestException("The declaration is " + d.getStatus());
        if (comment == null || comment.isBlank()) throw new BadRequestException("A comment is required to reject a declaration");
        d.setStatus(DeclarationStatus.REJECTED);
        decide(d, comment);
        log(d, "REJECTED", comment);
        producer.reviewed(d, "REJECTED", CurrentUser.employeeId(), comment);
        audit.record("TaxDeclaration", id, "REJECTED", comment);
        return toResponse(d);
    }

    public ProofResponse verifyProof(String proofId, BigDecimal approvedAmount, String comment) {
        TaxProof p = awaiting(proofId);
        InvestmentDeclaration inv = investments.findById(p.getInvestmentId()).orElseThrow();
        TaxDeclaration d = find(p.getDeclarationId());
        requireReviewer(d);
        BigDecimal amount = approvedAmount == null ? inv.getDeclaredAmount() : approvedAmount;
        if (amount.compareTo(inv.getDeclaredAmount()) > 0) throw new BadRequestException("The approved amount cannot exceed the declared amount");
        p.setStatus(ProofStatus.VERIFIED);
        review(p, comment);
        inv.setStatus(InvestmentStatus.VERIFIED);
        inv.setApprovedAmount(amount);
        investments.save(inv);
        recomputeApproved(d);
        log(d, "PROOF_VERIFIED", inv.getSection());
        audit.record("TaxProof", proofId, "VERIFIED", amount);
        return toProof(p);
    }

    public ProofResponse rejectProof(String proofId, String comment) {
        TaxProof p = awaiting(proofId);
        InvestmentDeclaration inv = investments.findById(p.getInvestmentId()).orElseThrow();
        TaxDeclaration d = find(p.getDeclarationId());
        requireReviewer(d);
        if (comment == null || comment.isBlank()) throw new BadRequestException("A comment is required to reject a proof");
        p.setStatus(ProofStatus.REJECTED);
        review(p, comment);
        inv.setStatus(InvestmentStatus.REJECTED);
        inv.setApprovedAmount(BigDecimal.ZERO);
        investments.save(inv);
        recomputeApproved(d);
        log(d, "PROOF_REJECTED", inv.getSection() + ": " + comment);
        producer.notify(d.getEmployeeId(), "TAX_PROOF_REJECTED", d.getId(), Map.of("section", inv.getSection(), "comment", comment), "taxproof:" + proofId);
        audit.record("TaxProof", proofId, "REJECTED", comment);
        return toProof(p);
    }

    // ------------------------------------------------------------------ queries
    @Transactional(readOnly = true)
    public DeclarationResponse get(String id) {
        TaxDeclaration d = find(id);
        requireView(d);
        return toResponse(d);
    }

    @Transactional(readOnly = true)
    public List<DeclarationResponse> mine(String financialYear) {
        String me = requireEmployee();
        List<TaxDeclaration> list = financialYear == null ? declarations.findByEmployeeIdOrderByFinancialYearDesc(me)
                : declarations.findByEmployeeIdAndFinancialYear(me, financialYear).stream().toList();
        return list.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<DeclarationResponse> pendingReview() {
        return declarations.findByStatusInOrderBySubmittedAtAsc(EnumSet.of(DeclarationStatus.SUBMITTED, DeclarationStatus.UNDER_REVIEW)).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ProofResponse> proofsAwaitingReview() {
        return proofs.findAwaitingReview().stream().map(this::toProof).toList();
    }

    @Transactional(readOnly = true)
    public List<HistoryResponse> history(String id) {
        TaxDeclaration d = find(id);
        requireView(d);
        return history.findByDeclarationIdOrderByCreatedAtAsc(id).stream().map(h -> new HistoryResponse(h.getId(), h.getDeclarationId(), h.getAction(), h.getStatus(), h.getTotalDeclared(),
                h.getComment(), h.getCreatedBy(), h.getCreatedAt())).toList();
    }

    @Transactional(readOnly = true)
    public StatusSummary summary(String financialYear) {
        Map<String, Long> by = new LinkedHashMap<>();
        for (DeclarationStatus s : DeclarationStatus.values()) by.put(s.name(), 0L);
        declarations.countByStatus(financialYear).forEach(c -> by.put(c.getStatus().name(), c.getCnt()));
        return new StatusSummary(financialYear, by, by.values().stream().mapToLong(Long::longValue).sum());
    }

    /** Deduction amounts by section that count for TDS: only for an APPROVED declaration; rejected investments count 0. */
    @Transactional(readOnly = true)
    public Map<String, BigDecimal> effectiveDeductions(String employeeId, String financialYear) {
        Map<String, BigDecimal> out = new HashMap<>();
        declarations.findByEmployeeIdAndFinancialYear(employeeId, financialYear).filter(d -> d.getStatus() == DeclarationStatus.APPROVED).ifPresent(d ->
                investments.findByDeclarationIdOrderBySectionAsc(d.getId()).forEach(i -> out.merge(i.getSection(), i.getApprovedAmount(), BigDecimal::add)));
        return out;
    }

    @Transactional(readOnly = true)
    public java.util.Optional<TaxDeclaration> approvedOrLatest(String employeeId, String financialYear) {
        return declarations.findByEmployeeIdAndFinancialYear(employeeId, financialYear);
    }

    // ------------------------------------------------------------------ helpers
    private TaxDeclaration create(String employeeId, DeclarationRequest req) {
        TaxDeclaration d = new TaxDeclaration();
        d.setEmployeeId(employeeId);
        d.setEmployeeName(employees.findById(employeeId).map(TaxEmployee::getFullName).orElse(null));
        d.setFinancialYear(req.financialYear());
        d.setRegime(Regime.valueOf(req.regime()));
        return declarations.save(d);
    }

    private void replaceInvestments(TaxDeclaration d, List<InvestmentRequest> list) {
        investments.deleteByDeclarationId(d.getId());
        investments.flush();
        BigDecimal total = BigDecimal.ZERO;
        for (InvestmentRequest r : list) {
            InvestmentDeclaration i = new InvestmentDeclaration();
            i.setDeclarationId(d.getId());
            i.setSection(r.section().toUpperCase());
            i.setDescription(r.description());
            i.setDeclaredAmount(r.declaredAmount());
            investments.save(i);
            total = total.add(r.declaredAmount());
        }
        d.setTotalDeclared(total);
    }

    private void recomputeApproved(TaxDeclaration d) {
        d.setTotalApproved(investments.findByDeclarationIdOrderBySectionAsc(d.getId()).stream().map(InvestmentDeclaration::getApprovedAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        declarations.save(d);
    }

    private void decide(TaxDeclaration d, String comment) {
        d.setReviewerId(CurrentUser.employeeId());
        d.setReviewComment(comment);
        d.setReviewedAt(Instant.now());
        declarations.save(d);
    }

    private TaxProof awaiting(String proofId) {
        TaxProof p = proofs.findById(proofId).orElseThrow(() -> ResourceNotFoundException.of("Proof", proofId));
        if (p.getStatus() != ProofStatus.SUBMITTED) throw new BadRequestException("The proof is already " + p.getStatus());
        return p;
    }

    private void review(TaxProof p, String comment) {
        p.setReviewerId(CurrentUser.employeeId());
        p.setReviewerComment(comment);
        p.setReviewedAt(Instant.now());
        proofs.save(p);
    }

    private void log(TaxDeclaration d, String action, String comment) {
        TaxDeclarationHistory h = new TaxDeclarationHistory();
        h.setDeclarationId(d.getId());
        h.setAction(action);
        h.setStatus(d.getStatus().name());
        h.setTotalDeclared(d.getTotalDeclared());
        h.setComment(comment);
        history.save(h);
    }

    private void requireOwner(TaxDeclaration d) {
        if (!d.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Only the declaring employee can do this");
    }

    private void requireReviewer(TaxDeclaration d) {
        if (d.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("You cannot review your own declaration");
    }

    private void requireView(TaxDeclaration d) {
        if (d.getEmployeeId().equals(CurrentUser.employeeId()) || CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.FINANCE_ADMIN, Role.SUPER_ADMIN)) return;
        throw new ForbiddenOperationException("You cannot view this declaration");
    }

    private static String requireEmployee() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return me;
    }

    private TaxDeclaration find(String id) {
        return declarations.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Tax declaration", id));
    }

    private ProofResponse toProof(TaxProof p) {
        return new ProofResponse(p.getId(), p.getInvestmentId(), p.getDocumentId(), p.getFileName(), p.getStatus().name(), p.getReviewerComment(), p.getReviewedAt(), p.getAttemptNumber(), p.getCreatedAt());
    }

    private DeclarationResponse toResponse(TaxDeclaration d) {
        List<InvestmentDeclaration> invs = investments.findByDeclarationIdOrderBySectionAsc(d.getId());
        Map<String, List<ProofResponse>> byInvestment = proofs.findByDeclarationIdOrderByCreatedAtAsc(d.getId()).stream().map(this::toProof).collect(Collectors.groupingBy(ProofResponse::investmentId));
        List<InvestmentResponse> out = invs.stream().map(i -> new InvestmentResponse(i.getId(), i.getSection(), i.getDescription(), i.getDeclaredAmount(), i.getApprovedAmount(),
                i.getStatus().name(), byInvestment.getOrDefault(i.getId(), List.of()))).toList();
        return new DeclarationResponse(d.getId(), d.getEmployeeId(), d.getEmployeeName(), d.getFinancialYear(), d.getRegime().name(), d.getStatus().name(), d.getTotalDeclared(),
                d.getTotalApproved(), d.getSubmittedAt(), d.getReviewerId(), d.getReviewComment(), d.getReviewedAt(), out);
    }
}
