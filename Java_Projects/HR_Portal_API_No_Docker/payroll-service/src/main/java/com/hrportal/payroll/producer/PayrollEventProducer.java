package com.hrportal.payroll.producer;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.HrEvents.PayrollLine;
import com.hrportal.common.events.HrEvents.PayrollProcessed;
import com.hrportal.common.events.HrEvents.PayslipGenerated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.payroll.entity.PayrollEntry;
import com.hrportal.payroll.entity.PayrollRun;
import com.hrportal.payroll.entity.Payslip;

@Component
public class PayrollEventProducer {
    private final EventPublisher publisher;

    public PayrollEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void processed(PayrollRun run, List<PayrollEntry> entries) {
        List<PayrollLine> lines = entries.stream().map(e -> new PayrollLine(e.getEmployeeId(), e.getDepartmentId(), e.getGross(), e.getDeductions(), e.getNet())).toList();
        publisher.publish(Topics.PAYROLL_PROCESSED, run.getPayrollMonth(), new PayrollProcessed(EventMetadata.of(Topics.PAYROLL_PROCESSED), null, run.getId(),
                run.getPayrollMonth(), run.getEmployeeCount(), run.getTotalGross(), run.getTotalNet(), lines));
    }

    /** Salary figures are NOT part of the payslip event or the notification text - only the fact that the payslip exists. */
    public void payslipGenerated(Payslip p) {
        publisher.publish(Topics.PAYSLIP_GENERATED, p.getEmployeeId(), new PayslipGenerated(EventMetadata.of(Topics.PAYSLIP_GENERATED), p.getEmployeeId(), p.getId(),
                p.getPayrollMonth(), p.getStoragePath(), p.getFileName()));
        publisher.publish(Topics.NOTIFICATION_REQUESTED, p.getEmployeeId(), NotificationRequested.of(p.getEmployeeId(), null, "PAYSLIP_AVAILABLE", "PAYSLIP_AVAILABLE",
                Map.of("month", p.getPayrollMonth()), "PAYSLIP", p.getId(), "payslip:" + p.getId()));
    }

    public void payrollCompleted(PayrollRun run, PayrollEntry e) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, e.getEmployeeId(), NotificationRequested.of(e.getEmployeeId(), null, "PAYROLL_COMPLETED", "PAYROLL_COMPLETED",
                Map.of("month", run.getPayrollMonth()), "PAYROLL_RUN", run.getId(), "payroll-done:" + run.getId() + ":" + e.getEmployeeId()));
    }
}
