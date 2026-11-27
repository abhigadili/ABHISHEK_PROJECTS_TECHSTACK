package com.fooddelivery.inventory.repository;

import com.fooddelivery.inventory.domain.Recipe;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {
    @EntityGraph(attributePaths = "ingredient")
    List<Recipe> findByMenuItemIdIn(Collection<Long> menuItemIds);

    @EntityGraph(attributePaths = "ingredient")
    List<Recipe> findByRestaurantId(Long restaurantId);

    @Modifying
    @Query("delete from Recipe r where r.menuItemId = :menuItemId")
    void deleteByMenuItemId(Long menuItemId);
}
