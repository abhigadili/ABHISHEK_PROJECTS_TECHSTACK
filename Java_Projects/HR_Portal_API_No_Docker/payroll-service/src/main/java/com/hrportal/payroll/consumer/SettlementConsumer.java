package com.hrportal.payroll.consumer;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.SettlementProcessed;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.payroll.service.AdjustmentLoanService;

/** Exit workflow step 7: the processed full-and-final settlement is recorded in payroll as a FINAL_SETTLEMENT adjustment. */
@Component
public class SettlementConsumer {
    private final IdempotentEventProcessor processor;
    private final AdjustmentLoanService service;

    public SettlementConsumer(IdempotentEventProcessor processor, AdjustmentLoanService service) {
        this.processor = processor;
        this.service = service;
    }

    @KafkaListener(topics = Topics.SETTLEMENT_PROCESSED, groupId = "hr-payroll-service")
    public void onSettlement(String payload) {
        processor.handle(payload, SettlementProcessed.class, "payroll.settlement-processed", e -> service.addFinalSettlement(e.employeeId(), e.resignationId(), e.netPayable()));
    }
}
