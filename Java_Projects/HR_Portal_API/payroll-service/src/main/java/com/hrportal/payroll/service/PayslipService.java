package com.hrportal.payroll.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.common.storage.FileStorage;
import com.hrportal.common.storage.FileStorage.StoredFile;
import com.hrportal.payroll.dto.PayrollDtos.PayslipResponse;
import com.hrportal.payroll.entity.PayrollEntry;
import com.hrportal.payroll.entity.PayrollEntryLine;
import com.hrportal.payroll.entity.Payslip;
import com.hrportal.payroll.pdf.PayslipPdfGenerator;
import com.hrportal.payroll.producer.PayrollEventProducer;
import com.hrportal.payroll.repository.PayrollRepositories.EntryRepository;
import com.hrportal.payroll.repository.PayrollRepositories.LineRepository;
import com.hrportal.payroll.repository.PayrollRepositories.PayslipRepository;

/** Payslip generation (PDF into the configurable file store), listing and secure download. */
@Service
public class PayslipService {
    private static final Logger log = LoggerFactory.getLogger(PayslipService.class);

    private final PayslipRepository payslips;
    private final EntryRepository entries;
    private final LineRepository lines;
    private final PayslipPdfGenerator pdf;
    private final FileStorage storage;
    private final PayrollEventProducer producer;
    private final AuditService audit;

    public PayslipService(PayslipRepository payslips, EntryRepository entries, LineRepository lines, PayslipPdfGenerator pdf, FileStorage storage,
                          PayrollEventProducer producer, AuditService audit) {
        this.payslips = payslips;
        this.entries = entries;
        this.lines = lines;
        this.pdf = pdf;
        this.storage = storage;
        this.producer = producer;
        this.audit = audit;
    }

    /** Generates (or regenerates) the payslip of every entry of a run. */
    @Transactional
    public int generateForRun(String runId) {
        List<PayrollEntry> list = entries.findByRunId(runId);
        Map<String, List<PayrollEntryLine>> byEntry = lines.findByEntryIdIn(list.stream().map(PayrollEntry::getId).toList()).stream()
                .collect(Collectors.groupingBy(PayrollEntryLine::getEntryId));
        int n = 0;
        for (PayrollEntry e : list) {
            byte[] bytes = pdf.generate(e, byEntry.getOrDefault(e.getId(), List.of()));
            try {
                StoredFile f = storage.store("payslips/" + e.getPayrollMonth(), "payslip.pdf", new ByteArrayInputStream(bytes));
                Payslip p = payslips.findByEntryId(e.getId()).orElseGet(Payslip::new);
                if (p.getStoragePath() != null) storage.delete(p.getStoragePath());
                p.setEntryId(e.getId());
                p.setRunId(runId);
                p.setEmployeeId(e.getEmployeeId());
                p.setPayrollMonth(e.getPayrollMonth());
                p.setStoragePath(f.relativePath());
                p.setFileName("payslip-" + e.getEmployeeCode() + "-" + e.getPayrollMonth() + ".pdf");
                p.setSizeBytes(f.sizeBytes());
                p.setSha256(f.sha256());
                p.setGeneratedAt(java.time.Instant.now());
                p = payslips.save(p);
                producer.payslipGenerated(p);
                n++;
            } catch (IOException ex) {
                throw new ServiceUnavailableException("Could not store the payslip of " + e.getEmployeeCode());
            }
        }
        audit.record("PayrollRun", runId, "PAYSLIPS_GENERATED", n);
        log.info("Generated {} payslip(s) for run {}", n, runId);
        return n;
    }

    @Transactional(readOnly = true)
    public List<PayslipResponse> mine() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return forEmployee(me);
    }

    @Transactional(readOnly = true)
    public List<PayslipResponse> forEmployee(String employeeId) {
        requireAccess(employeeId);
        List<Payslip> list = payslips.findByEmployeeIdOrderByPayrollMonthDesc(employeeId);
        Map<String, PayrollEntry> byId = new HashMap<>();
        entries.findAllById(list.stream().map(Payslip::getEntryId).toList()).forEach(e -> byId.put(e.getId(), e));
        return list.stream().map(p -> {
            PayrollEntry e = byId.get(p.getEntryId());
            return new PayslipResponse(p.getId(), p.getEntryId(), p.getRunId(), p.getEmployeeId(), p.getPayrollMonth(), p.getFileName(), p.getSizeBytes(), p.getGeneratedAt(),
                    e == null ? null : e.getGross(), e == null ? null : e.getNet());
        }).toList();
    }

    public record Download(String fileName, long size, Resource resource) { }

    /** Streams the PDF after the ownership check ("employees access their own payslips"). */
    @Transactional(readOnly = true)
    public Download download(String payslipId) {
        Payslip p = payslips.findById(payslipId).orElseThrow(() -> ResourceNotFoundException.of("Payslip", payslipId));
        requireAccess(p.getEmployeeId());
        try {
            InputStream in = storage.open(p.getStoragePath());
            audit.record("Payslip", payslipId, "DOWNLOADED", p.getEmployeeId());
            return new Download(p.getFileName(), p.getSizeBytes(), new InputStreamResource(in));
        } catch (IOException e) {
            throw new BadRequestException("The payslip file is not available");
        }
    }

    private void requireAccess(String employeeId) {
        if (employeeId.equals(CurrentUser.employeeId())) return;
        if (CurrentUser.get().map(u -> u.permissions().contains("PAYSLIP_VIEW_ALL")).orElse(false) || CurrentUser.hasRole(Role.SUPER_ADMIN)) return;
        throw new ForbiddenOperationException("You can only access your own payslips");
    }
}
