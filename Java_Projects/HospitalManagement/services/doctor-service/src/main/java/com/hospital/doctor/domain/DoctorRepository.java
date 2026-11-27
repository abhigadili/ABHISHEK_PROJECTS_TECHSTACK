package com.hospital.doctor.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {
    boolean existsByLicenseNumber(String licenseNumber);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUserId(Long userId);

    @Query("""
            select d from Doctor d
            where (:specialization is null or lower(d.specialization) = lower(:specialization))
              and (:hospitalId is null or d.hospitalId = :hospitalId)
              and (:departmentId is null or d.departmentId = :departmentId)
              and (:active is null or d.active = :active)
            """)
    Page<Doctor> search(@Param("specialization") String specialization, @Param("hospitalId") Long hospitalId,
                        @Param("departmentId") Long departmentId, @Param("active") Boolean active, Pageable pageable);

    @Query("select distinct d.specialization from Doctor d where d.active = true order by d.specialization")
    List<String> specializations();

    /** Active doctors who work on the given weekday and have not marked the date as a day off. */
    @Query("""
            select d from Doctor d
            where d.active = true
              and (:specialization is null or lower(d.specialization) = lower(:specialization))
              and exists (select 1 from DoctorSchedule s where s.doctor = d and s.dayOfWeek = :dow)
              and not exists (select 1 from DoctorUnavailability u where u.doctor = d and u.unavailableDate = :date)
            order by d.lastName, d.firstName
            """)
    List<Doctor> findWorkingOn(@Param("dow") DayOfWeek dow, @Param("date") LocalDate date, @Param("specialization") String specialization);
}
