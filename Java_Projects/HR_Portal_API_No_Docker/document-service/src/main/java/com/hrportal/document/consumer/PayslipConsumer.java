package com.hrportal.document.consumer;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.PayslipGenerated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.document.entity.Enums.Source;
import com.hrportal.document.service.DocumentService;

/** Payslip storage: every generated payslip is registered as a (sensitive, approved) PAYSLIP document of the employee. */
@Component
public class PayslipConsumer {
    private final IdempotentEventProcessor processor;
    private final DocumentService documents;

    public PayslipConsumer(IdempotentEventProcessor processor, DocumentService documents) {
        this.processor = processor;
        this.documents = documents;
    }

    @KafkaListener(topics = Topics.PAYSLIP_GENERATED, groupId = "hr-document-service")
    public void onPayslip(String payload) {
        processor.handle(payload, PayslipGenerated.class, "document.payslip-generated", e ->
                documents.registerExisting(e.employeeId(), "PAYSLIP", "Payslip " + e.month(), e.fileName(), e.filePath(), Source.PAYSLIP));
    }
}
