package com.hrportal.employee.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.employee.entity.EmployeeSequence;
import com.hrportal.employee.repository.ChildRepositories.SequenceRepository;

/** Generates EMP00001, EMP00002 ... The counter row is locked with SELECT ... FOR UPDATE (pessimistic lock). */
@Component
public class EmployeeCodeGenerator {
    private final SequenceRepository sequence;

    public EmployeeCodeGenerator(SequenceRepository sequence) {
        this.sequence = sequence;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String next() {
        EmployeeSequence s = sequence.lockCounter().orElseThrow(() -> new IllegalStateException("employee_sequence is not initialised"));
        long value = s.getNextValue();
        s.setNextValue(value + 1);
        sequence.save(s);
        return String.format("EMP%05d", value);
    }
}
