package com.hospital.laboratory.service;

import java.math.BigDecimal;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.hospital.laboratory.domain.LabTest;
import com.hospital.laboratory.domain.LabTestRepository;

import lombok.extern.log4j.Log4j2;

/** Seeds a small standard catalogue the first time the service starts. */
@Log4j2
@Component
public class LabCatalogSeeder implements ApplicationRunner {
    private final LabTestRepository tests;

    public LabCatalogSeeder(LabTestRepository tests) {
        this.tests = tests;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (tests.count() > 0) return;
        add("CBC", "Complete Blood Count", "Blood", "350.00", 6);
        add("LIPID", "Lipid Profile", "Blood", "600.00", 12);
        add("HBA1C", "HbA1c (Glycated Hemoglobin)", "Blood", "550.00", 12);
        add("TSH", "Thyroid Stimulating Hormone", "Blood", "450.00", 12);
        add("UA", "Urine Analysis", "Urine", "200.00", 4);
        add("LFT", "Liver Function Test", "Blood", "700.00", 12);
        log.info("Seeded {} lab tests", tests.count());
    }

    private void add(String code, String name, String sample, String price, int hours) {
        LabTest t = new LabTest();
        t.setCode(code);
        t.setName(name);
        t.setSampleType(sample);
        t.setPrice(new BigDecimal(price));
        t.setTurnaroundHours(hours);
        tests.save(t);
    }
}
