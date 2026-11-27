package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.domain.Restaurant;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RestaurantRepository extends JpaRepository<Restaurant, Long>, JpaSpecificationExecutor<Restaurant> {
    @EntityGraph(attributePaths = {"cuisines", "hours"})
    @Query("select r from Restaurant r where r.id = :id")
    Optional<Restaurant> findDetailed(Long id);

    List<Restaurant> findByOwnerUserId(Long ownerUserId);

    @Query("select distinct c from Restaurant r join r.cuisines c where r.status = 'APPROVED' order by c")
    List<String> findApprovedCuisines();

    @Query("select r.category from Restaurant r where r.status = 'APPROVED' and r.category is not null group by r.category order by r.category")
    List<String> findApprovedCategories();

    /** Bounding-box prefilter; exact great-circle distance is computed afterwards in Java. */
    @Query("select r from Restaurant r where r.status = 'APPROVED' and r.latitude between :minLat and :maxLat and r.longitude between :minLng and :maxLng")
    List<Restaurant> findInBox(double minLat, double maxLat, double minLng, double maxLng);

    long countByStatus(Restaurant.Status status);
}
