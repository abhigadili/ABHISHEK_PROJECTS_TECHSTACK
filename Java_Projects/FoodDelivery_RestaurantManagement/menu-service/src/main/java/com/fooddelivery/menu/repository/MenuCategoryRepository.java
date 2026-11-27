package com.fooddelivery.menu.repository;

import com.fooddelivery.menu.domain.MenuCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MenuCategoryRepository extends JpaRepository<MenuCategory, Long> {
    List<MenuCategory> findByRestaurantIdAndActiveTrueOrderByDisplayOrderAscNameAsc(Long restaurantId);
    boolean existsByRestaurantIdAndNameIgnoreCase(Long restaurantId, String name);
}
