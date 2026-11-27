package com.hrportal.tax.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.security.CurrentUser;
import com.hrportal.tax.dto.TaxDtos.ComputationResponse;
import com.hrportal.tax.dto.TaxDtos.DeclarationRequest;
import com.hrportal.tax.dto.TaxDtos.DeclarationResponse;
import com.hrportal.tax.dto.TaxDtos.DecisionRequest;
import com.hrportal.tax.dto.TaxDtos.HistoryResponse;
import com.hrportal.tax.dto.TaxDtos.IncomeTaxStatement;
import com.hrportal.tax.dto.TaxDtos.MonthlyTdsResponse;
import com.hrportal.tax.dto.TaxDtos.ProofRequest;
import com.hrportal.tax.dto.TaxDtos.ProofResponse;
import com.hrportal.tax.dto.TaxDtos.RuleRequest;
import com.hrportal.tax.dto.TaxDtos.RuleResponse;
import com.hrportal.tax.dto.TaxDtos.StatusSummary;
import com.hrportal.tax.dto.TaxDtos.TaxDocumentRequest;
import com.hrportal.tax.dto.TaxDtos.TaxDocumentResponse;
import com.hrportal.tax.dto.TaxDtos.VerifyProofRequest;
import com.hrportal.tax.service.DeclarationService;
import com.hrportal.tax.service.TaxComputationService;
import com.hrportal.tax.service.TaxRuleService;
import com.hrportal.tax.service.TaxSupportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Tax")
@RestController
@RequestMapping("/api/v1/tax")
public class TaxController {
    private final TaxRuleService rules;
    private final DeclarationService declarations;
    private final TaxComputationService computation;
    private final TaxSupportService support;

    public TaxController(TaxRuleService rules, DeclarationService declarations, TaxComputationService computation, TaxSupportService support) {
        this.rules = rules;
        this.declarations = declarations;
        this.computation = computation;
        this.support = support;
    }

    // ---- rules
    @Operation(summary = "Tax rules of a financial year (sample values - verify before production use)")
    @GetMapping("/rules")
    public List<RuleResponse> rules(@RequestParam(required = false) String financialYear) {
        return rules.list(financialYear);
    }

    @PostMapping("/rules")
    @PreAuthorize("hasAuthority('PERM_TAX_CONFIG')")
    @ResponseStatus(HttpStatus.CREATED)
    public RuleResponse createRule(@Valid @RequestBody RuleRequest req) {
        return rules.create(req);
    }

    @PutMapping("/rules/{id}")
    @PreAuthorize("hasAuthority('PERM_TAX_CONFIG')")
    public RuleResponse updateRule(@PathVariable String id, @Valid @RequestBody RuleRequest req) {
        return rules.update(id, req);
    }

    // ---- declaration (employee)
    @Operation(summary = "Create / replace my declaration for a financial year (while DRAFT or after a rejection)")
    @PutMapping("/declarations")
    public DeclarationResponse save(@Valid @RequestBody DeclarationRequest req) {
        return declarations.save(req);
    }

    @GetMapping("/declarations/me")
    public List<DeclarationResponse> mine(@RequestParam(required = false) String financialYear) {
        return declarations.mine(financialYear);
    }

    @GetMapping("/declarations/{id}")
    public DeclarationResponse get(@PathVariable String id) {
        return declarations.get(id);
    }

    @PostMapping("/declarations/{id}/submit")
    public DeclarationResponse submit(@PathVariable String id) {
        return declarations.submit(id);
    }

    @Operation(summary = "Attach a supporting proof (document id from the Document service) to an investment; also used to resubmit a rejected proof")
    @PostMapping("/declarations/{id}/investments/{investmentId}/proofs")
    @ResponseStatus(HttpStatus.CREATED)
    public ProofResponse addProof(@PathVariable String id, @PathVariable String investmentId, @Valid @RequestBody ProofRequest req) {
        return declarations.addProof(id, investmentId, req);
    }

    @GetMapping("/declarations/{id}/history")
    public List<HistoryResponse> history(@PathVariable String id) {
        return declarations.history(id);
    }

    // ---- review (HR / finance)
    @GetMapping("/declarations/pending-review")
    @PreAuthorize("hasAuthority('PERM_TAX_REVIEW')")
    public List<DeclarationResponse> pending() {
        return declarations.pendingReview();
    }

    @PostMapping("/declarations/{id}/start-review")
    @PreAuthorize("hasAuthority('PERM_TAX_REVIEW')")
    public DeclarationResponse startReview(@PathVariable String id) {
        return declarations.startReview(id);
    }

    @PostMapping("/declarations/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_TAX_REVIEW')")
    public DeclarationResponse approve(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return declarations.approve(id, req == null ? null : req.comment());
    }

    @PostMapping("/declarations/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_TAX_REVIEW')")
    public DeclarationResponse reject(@PathVariable String id, @Valid @RequestBody DecisionRequest req) {
        return declarations.reject(id, req.comment());
    }

    @GetMapping("/proofs/pending")
    @PreAuthorize("hasAuthority('PERM_TAX_REVIEW')")
    public List<ProofResponse> proofsPending() {
        return declarations.proofsAwaitingReview();
    }

    @PostMapping("/proofs/{proofId}/verify")
    @PreAuthorize("hasAuthority('PERM_TAX_REVIEW')")
    public ProofResponse verify(@PathVariable String proofId, @Valid @RequestBody(required = false) VerifyProofRequest req) {
        return declarations.verifyProof(proofId, req == null ? null : req.approvedAmount(), req == null ? null : req.comment());
    }

    @PostMapping("/proofs/{proofId}/reject")
    @PreAuthorize("hasAuthority('PERM_TAX_REVIEW')")
    public ProofResponse rejectProof(@PathVariable String proofId, @Valid @RequestBody DecisionRequest req) {
        return declarations.rejectProof(proofId, req.comment());
    }

    @GetMapping("/reports/status")
    @PreAuthorize("hasAnyRole('HR_ADMIN','FINANCE_ADMIN','SUPER_ADMIN')")
    public StatusSummary status(@RequestParam String financialYear) {
        return declarations.summary(financialYear);
    }

    // ---- computation
    @Operation(summary = "Annual tax computation of an employee (self / finance)")
    @GetMapping("/computation")
    public ComputationResponse compute(@RequestParam(required = false) String employeeId, @RequestParam String financialYear) {
        return computation.compute(employeeId == null ? CurrentUser.employeeId() : employeeId, financialYear);
    }

    @Operation(summary = "Monthly TDS for payroll: (annual tax - TDS of earlier months) / months remaining")
    @GetMapping("/monthly-tds")
    public MonthlyTdsResponse monthlyTds(@RequestParam String employeeId, @RequestParam String month) {
        return computation.monthlyTds(employeeId, month);
    }

    @Operation(summary = "Income tax statement / annual tax summary with the month-wise TDS table")
    @GetMapping("/statement")
    public IncomeTaxStatement statement(@RequestParam(required = false) String employeeId, @RequestParam String financialYear) {
        return computation.statement(employeeId == null ? CurrentUser.employeeId() : employeeId, financialYear);
    }

    // ---- documents / reminders
    @Operation(summary = "Register an employee tax document (Form 16 ...) stored in the Document service")
    @PostMapping("/documents")
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','HR_ADMIN','SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public TaxDocumentResponse addDocument(@Valid @RequestBody TaxDocumentRequest req) {
        return support.addDocument(req);
    }

    @GetMapping("/documents")
    public List<TaxDocumentResponse> documents(@RequestParam(required = false) String employeeId, @RequestParam(required = false) String financialYear) {
        return support.documents(employeeId == null ? CurrentUser.employeeId() : employeeId, financialYear);
    }

    @PostMapping("/reminders/run")
    @PreAuthorize("hasAuthority('PERM_TAX_REVIEW')")
    public java.util.Map<String, Integer> reminders() {
        return java.util.Map.of("queued", support.sendReminders());
    }
}
