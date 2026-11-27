package com.fooddelivery.review.repository;

import com.fooddelivery.review.domain.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    Optional<Review> findByOrderId(Long orderId);

    @EntityGraph(attributePaths = "itemRatings")
    Page<Review> findByRestaurantIdAndStatus(Long restaurantId, Review.Status status, Pageable pageable);

    @EntityGraph(attributePaths = "itemRatings")
    Page<Review> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    @EntityGraph(attributePaths = "itemRatings")
    Page<Review> findByStatusOrderByCreatedAtDesc(Review.Status status, Pageable pageable);

    @EntityGraph(attributePaths = "itemRatings")
    Page<Review> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("select avg(r.restaurantRating), count(r) from Review r where r.restaurantId = :rid and r.status = 'VISIBLE'")
    List<Object[]> restaurantAggregate(Long rid);

    @Query("select r.restaurantRating, count(r) from Review r where r.restaurantId = :rid and r.status = 'VISIBLE' group by r.restaurantRating")
    List<Object[]> restaurantDistribution(Long rid);

    @Query("select avg(r.deliveryRating), count(r.deliveryRating) from Review r where r.deliveryPartnerId = :pid and r.status = 'VISIBLE' and r.deliveryRating is not null")
    List<Object[]> partnerAggregate(Long pid);

    @Query("select avg(i.rating), count(i) from ItemRating i where i.menuItemId = :itemId and i.review.status = 'VISIBLE'")
    List<Object[]> itemAggregate(Long itemId);
}
