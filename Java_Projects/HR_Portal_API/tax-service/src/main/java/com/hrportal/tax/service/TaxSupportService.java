package com.hrportal.tax.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.IsoFields;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.tax.dto.TaxDtos.TaxDocumentRequest;
import com.hrportal.tax.dto.TaxDtos.TaxDocumentResponse;
import com.hrportal.tax.entity.Enums.DeclarationStatus;
import com.hrportal.tax.entity.Enums.DocType;
import com.hrportal.tax.entity.TaxDocument;
import com.hrportal.tax.entity.TaxEmployee;
import com.hrportal.tax.producer.TaxEventProducer;
import com.hrportal.tax.repository.TaxRepositories.DeclarationRepository;
import com.hrportal.tax.repository.TaxRepositories.DocumentRepository;
import com.hrportal.tax.repository.TaxRepositories.TaxEmployeeRepository;

/** Employee tax documents (Form 16 ...) and the tax-declaration reminders. */
@Service
public class TaxSupportService {
    private static final Logger log = LoggerFactory.getLogger(TaxSupportService.class);

    private final DocumentRepository documents;
    private final TaxEmployeeRepository employees;
    private final DeclarationRepository declarations;
    private final TaxEventProducer producer;
    private final AuditService audit;

    public TaxSupportService(DocumentRepository documents, TaxEmployeeRepository employees, DeclarationRepository declarations, TaxEventProducer producer, AuditService audit) {
        this.documents = documents;
        this.employees = employees;
        this.declarations = declarations;
        this.producer = producer;
        this.audit = audit;
    }

    @Transactional
    public TaxDocumentResponse addDocument(TaxDocumentRequest req) {
        TaxDocument d = BeanMapper.toEntity(req, TaxDocument.class);
        d = documents.save(d);
        audit.record("TaxDocument", d.getId(), "REGISTERED", req.employeeId() + " " + req.docType() + " " + req.financialYear());
        if (d.getDocType() == DocType.FORM16_PART_A || d.getDocType() == DocType.FORM16_PART_B) {
            producer.notify(req.employeeId(), "FORM16_AVAILABLE", d.getId(), Map.of("financialYear", req.financialYear()), "form16:" + d.getId());
        }
        return BeanMapper.toRecord(d, TaxDocumentResponse.class);
    }

    @Transactional(readOnly = true)
    public List<TaxDocumentResponse> documents(String employeeId, String financialYear) {
        if (!employeeId.equals(CurrentUser.employeeId()) && !CurrentUser.hasAnyRole(Role.FINANCE_ADMIN, Role.HR_ADMIN, Role.SUPER_ADMIN)) throw new ForbiddenOperationException("You can only view your own tax documents");
        List<TaxDocument> list = financialYear == null ? documents.findByEmployeeIdOrderByFinancialYearDescCreatedAtDesc(employeeId)
                : documents.findByEmployeeIdAndFinancialYearOrderByCreatedAtDesc(employeeId, financialYear);
        return BeanMapper.toRecords(list, TaxDocumentResponse.class);
    }

    /** Reminds every active employee who has not yet submitted a declaration for the current financial year (one reminder per employee per week). */
    @Transactional
    public int sendReminders() {
        String fy = TaxComputationService.financialYearOf(YearMonth.now());
        String week = LocalDate.now().get(IsoFields.WEEK_BASED_YEAR) + "W" + LocalDate.now().get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        Set<DeclarationStatus> done = Set.of(DeclarationStatus.SUBMITTED, DeclarationStatus.UNDER_REVIEW, DeclarationStatus.APPROVED);
        int sent = 0;
        for (TaxEmployee e : employees.findByStatusIn(List.of("ACTIVE", "ON_NOTICE"))) {
            boolean submitted = declarations.findByEmployeeIdAndFinancialYear(e.getEmployeeId(), fy).map(d -> done.contains(d.getStatus())).orElse(false);
            if (submitted) continue;
            producer.notify(e.getEmployeeId(), "TAX_DECLARATION_REMINDER", fy, Map.of("financialYear", fy, "name", String.valueOf(e.getFullName())), "taxreminder:" + e.getEmployeeId() + ":" + fy + ":" + week);
            sent++;
        }
        log.info("Tax declaration reminders queued for {} employee(s) (FY {})", sent, fy);
        return sent;
    }
}
