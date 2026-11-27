package com.fooddelivery.inventory.repository;

import com.fooddelivery.inventory.domain.Ingredient;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {
    List<Ingredient> findByRestaurantIdOrderByName(Long restaurantId);
    boolean existsByRestaurantIdAndNameIgnoreCase(Long restaurantId, String name);

    /** SELECT ... FOR UPDATE, ordered by id (consistent order = no deadlocks between concurrent orders). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Ingredient i where i.id in :ids order by i.id")
    List<Ingredient> lockAllByIds(Collection<Long> ids);

    @Query("select i from Ingredient i where i.quantity <= i.lowStockThreshold order by i.restaurantId, i.name")
    List<Ingredient> findAllLow();

    @Query("select i from Ingredient i where i.restaurantId = :rid and i.quantity <= i.lowStockThreshold order by i.name")
    List<Ingredient> findLow(Long rid);
}
