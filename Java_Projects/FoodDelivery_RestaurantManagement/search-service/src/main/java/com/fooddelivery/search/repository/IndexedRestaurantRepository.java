package com.fooddelivery.search.repository;

import com.fooddelivery.search.domain.IndexedRestaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface IndexedRestaurantRepository extends JpaRepository<IndexedRestaurant, Long> {
    /** Relevance: exact prefix on the name scores highest, then name contains, then cuisine, then city. */
    @Query("""
            select r from IndexedRestaurant r where r.active = true and
              (lower(r.name) like concat('%', :q, '%') or lower(r.cuisines) like concat('%', :q, '%') or lower(r.city) like concat('%', :q, '%'))
              and (:city is null or lower(r.city) = :city)
            order by (case when lower(r.name) like concat(:q, '%') then 0 when lower(r.name) like concat('%', :q, '%') then 1
                           when lower(r.cuisines) like concat('%', :q, '%') then 2 else 3 end), r.rating desc, r.name
            """)
    List<IndexedRestaurant> search(String q, String city, org.springframework.data.domain.Pageable page);

    @Query("select r from IndexedRestaurant r where r.active = true and (:city is null or lower(r.city) = :city) order by r.rating desc, r.name")
    List<IndexedRestaurant> browse(String city, org.springframework.data.domain.Pageable page);

    @Query("select distinct r.city from IndexedRestaurant r where r.active = true and r.city is not null order by r.city")
    List<String> cities();

    @Query("select r.cuisines from IndexedRestaurant r where r.active = true and r.cuisines is not null")
    List<String> cuisineLists();

    @Query("select r.name from IndexedRestaurant r where r.active = true and lower(r.name) like concat(:q, '%') order by r.name")
    List<String> suggestNames(String q, org.springframework.data.domain.Pageable page);
}
