package com.fooddelivery.menu.repository;

import com.fooddelivery.menu.domain.ItemPopularity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ItemPopularityRepository extends JpaRepository<ItemPopularity, Long> {
    List<ItemPopularity> findByRestaurantIdOrderByOrderedQuantityDesc(Long restaurantId, Pageable pageable);
    List<ItemPopularity> findAllByOrderByOrderedQuantityDesc(Pageable pageable);
}
