package com.fooddelivery.search.repository;

import com.fooddelivery.search.domain.IndexedFood;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface IndexedFoodRepository extends JpaRepository<IndexedFood, Long> {
    @Query("""
            select f from IndexedFood f join IndexedRestaurant r on r.restaurantId = f.restaurantId
            where r.active = true and f.available = true
              and (lower(f.name) like concat('%', :q, '%') or lower(f.description) like concat('%', :q, '%') or lower(f.category) like concat('%', :q, '%'))
              and (:city is null or lower(r.city) = :city) and (:veg is null or f.vegetarian = :veg)
            order by (case when lower(f.name) like concat(:q, '%') then 0 when lower(f.name) like concat('%', :q, '%') then 1 else 2 end), f.name
            """)
    List<IndexedFood> search(String q, String city, Boolean veg, Pageable page);

    @Query("select distinct f.category from IndexedFood f join IndexedRestaurant r on r.restaurantId = f.restaurantId where r.active = true and f.category is not null order by f.category")
    List<String> categories();

    @Query("select f.name from IndexedFood f join IndexedRestaurant r on r.restaurantId = f.restaurantId where r.active = true and f.available = true and lower(f.name) like concat(:q, '%') order by f.name")
    List<String> suggestNames(String q, Pageable page);
}
