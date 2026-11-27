package com.hospital.pharmacy.service;

import java.math.BigDecimal;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.hospital.pharmacy.domain.Medicine;
import com.hospital.pharmacy.domain.MedicineRepository;

import lombok.extern.log4j.Log4j2;

/** Initial inventory so the prescription -> pharmacy flow works out of the box. */
@Log4j2
@Component
public class MedicineSeeder implements ApplicationRunner {
    private final MedicineRepository medicines;

    public MedicineSeeder(MedicineRepository medicines) {
        this.medicines = medicines;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (medicines.count() > 0) return;
        add("MED-PARA500", "Paracetamol 500mg", "Paracetamol", "2.50", 500);
        add("MED-AMOX500", "Amoxicillin 500mg", "Amoxicillin", "8.00", 300);
        add("MED-IBU400", "Ibuprofen 400mg", "Ibuprofen", "4.00", 400);
        add("MED-METF500", "Metformin 500mg", "Metformin", "3.50", 350);
        add("MED-ATOR10", "Atorvastatin 10mg", "Atorvastatin", "6.00", 250);
        add("MED-CETI10", "Cetirizine 10mg", "Cetirizine", "1.50", 600);
        log.info("Seeded {} medicines", medicines.count());
    }

    private void add(String sku, String name, String generic, String price, int stock) {
        Medicine m = new Medicine();
        m.setSku(sku);
        m.setName(name);
        m.setGenericName(generic);
        m.setUnitPrice(new BigDecimal(price));
        m.setStockQuantity(stock);
        medicines.save(m);
    }
}
