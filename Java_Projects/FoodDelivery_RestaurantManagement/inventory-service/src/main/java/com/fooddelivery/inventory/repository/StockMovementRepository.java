package com.fooddelivery.inventory.repository;

import com.fooddelivery.inventory.domain.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
    Page<StockMovement> findByIngredientIdOrderByCreatedAtDesc(Long ingredientId, Pageable pageable);
    List<StockMovement> findByOrderIdAndType(Long orderId, StockMovement.Type type);
}
