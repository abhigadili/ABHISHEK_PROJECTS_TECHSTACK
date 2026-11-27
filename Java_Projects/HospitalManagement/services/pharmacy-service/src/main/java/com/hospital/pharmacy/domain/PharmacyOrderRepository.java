package com.hospital.pharmacy.domain;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PharmacyOrderRepository extends JpaRepository<PharmacyOrder, Long> {
    @Query("select distinct o from PharmacyOrder o left join fetch o.items where o.id = :id")
    Optional<PharmacyOrder> findWithItems(@Param("id") Long id);

    @Query("select distinct o from PharmacyOrder o left join fetch o.items where o.prescriptionId = :pid")
    Optional<PharmacyOrder> findByPrescription(@Param("pid") Long prescriptionId);

    boolean existsByPrescriptionId(Long prescriptionId);

    Page<PharmacyOrder> findByStatus(OrderStatus status, Pageable pageable);
}
