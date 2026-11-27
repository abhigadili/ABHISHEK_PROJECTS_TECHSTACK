package com.hospital.pharmacy.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface MedicineRepository extends JpaRepository<Medicine, Long> {
    boolean existsBySku(String sku);

    @Query("""
            select m from Medicine m where m.active = true
              and (lower(m.name) = lower(:name) or lower(m.genericName) = lower(:name))
            order by m.stockQuantity desc
            """)
    List<Medicine> findMatches(@Param("name") String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Medicine m where m.id = :id")
    Optional<Medicine> lockById(@Param("id") Long id);

    @Query("select m from Medicine m where m.active = true and m.stockQuantity <= m.reorderLevel and (m.lastLowStockAlertAt is null or m.lastLowStockAlertAt < :before)")
    List<Medicine> findLowStockNeedingAlert(@Param("before") Instant before);

    List<Medicine> findByActiveTrueOrderByName();
}
