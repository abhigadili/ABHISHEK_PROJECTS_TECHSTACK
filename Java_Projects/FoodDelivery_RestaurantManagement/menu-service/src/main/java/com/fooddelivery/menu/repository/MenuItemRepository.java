package com.fooddelivery.menu.repository;

import com.fooddelivery.menu.domain.MenuItem;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MenuItemRepository extends JpaRepository<MenuItem, Long>, JpaSpecificationExecutor<MenuItem> {
    /** Fetch join: one query loads items + category + variants (avoids N+1 when rendering a whole menu). */
    @Query("select distinct i from MenuItem i join fetch i.category left join fetch i.variants where i.restaurantId = :rid and i.active = true")
    List<MenuItem> findMenu(Long rid);

    @EntityGraph(attributePaths = {"category", "variants", "addOns"})
    @Query("select i from MenuItem i where i.id = :id")
    Optional<MenuItem> findDetailed(Long id);

    @EntityGraph(attributePaths = {"category", "variants", "addOns"})
    @Query("select i from MenuItem i where i.id in :ids")
    List<MenuItem> findAllDetailed(Collection<Long> ids);

    long countByRestaurantIdAndActiveTrue(Long restaurantId);
}
