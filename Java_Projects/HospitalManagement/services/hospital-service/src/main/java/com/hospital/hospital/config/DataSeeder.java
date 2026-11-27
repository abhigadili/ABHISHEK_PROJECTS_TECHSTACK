package com.hospital.hospital.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.security.Role;
import com.hospital.hospital.domain.Department;
import com.hospital.hospital.domain.DepartmentRepository;
import com.hospital.hospital.domain.Hospital;
import com.hospital.hospital.domain.HospitalRepository;
import com.hospital.hospital.domain.UserAccount;
import com.hospital.hospital.domain.UserAccountRepository;

import lombok.extern.log4j.Log4j2;

/** First-run bootstrap: one user per role (so every workflow can be exercised) and one default hospital. */
@Log4j2
@Component
public class DataSeeder implements ApplicationRunner {
    private final UserAccountRepository users;
    private final HospitalRepository hospitals;
    private final DepartmentRepository departments;
    private final PasswordEncoder encoder;
    private final String adminPassword;
    private final String staffPassword;

    public DataSeeder(UserAccountRepository users, HospitalRepository hospitals, DepartmentRepository departments,
                      PasswordEncoder encoder, @Value("${hospital.seed.admin-password}") String adminPassword,
                      @Value("${hospital.seed.staff-password}") String staffPassword) {
        this.users = users;
        this.hospitals = hospitals;
        this.departments = departments;
        this.encoder = encoder;
        this.adminPassword = adminPassword;
        this.staffPassword = staffPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seed("admin", "admin@hospital.local", adminPassword, Role.ADMIN);
        seed("doctor1", "doctor1@hospital.local", staffPassword, Role.DOCTOR);
        seed("doctor2", "doctor2@hospital.local", staffPassword, Role.DOCTOR);
        seed("labstaff1", "labstaff1@hospital.local", staffPassword, Role.LAB_STAFF);
        seed("pharmacist1", "pharmacist1@hospital.local", staffPassword, Role.PHARMACIST);
        seed("billing1", "billing1@hospital.local", staffPassword, Role.BILLING_STAFF);
        if (!hospitals.existsByCode("CGH")) {
            Hospital h = new Hospital();
            h.setName("City General Hospital");
            h.setCode("CGH");
            h.setCity("Hyderabad");
            h.setAddress("1 Health Avenue");
            h.setPhone("+91-40-5550100");
            h.setEmail("info@cgh.hospital.local");
            h = hospitals.save(h);
            for (String n : new String[]{"Cardiology", "General Medicine", "Pediatrics", "Orthopedics", "Laboratory", "Pharmacy"}) {
                Department d = new Department();
                d.setHospital(h);
                d.setName(n);
                departments.save(d);
            }
            log.info("Seeded default hospital CGH with 6 departments");
        }
    }

    private void seed(String username, String email, String password, Role role) {
        if (users.existsByUsername(username)) return;
        UserAccount u = new UserAccount();
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        u.setRole(role);
        users.save(u);
        log.info("Seeded {} user '{}'", role, username);
    }
}
