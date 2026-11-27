package com.fooddelivery.admin.repository;

import com.fooddelivery.admin.domain.ActivityEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityEntryRepository extends JpaRepository<ActivityEntry, Long> {
    Page<ActivityEntry> findAllByOrderByOccurredAtDesc(Pageable pageable);
}
