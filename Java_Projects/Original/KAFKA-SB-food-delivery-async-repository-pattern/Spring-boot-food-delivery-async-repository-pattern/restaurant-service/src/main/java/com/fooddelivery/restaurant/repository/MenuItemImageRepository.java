package com.fooddelivery.restaurant.repository;

import com.fooddelivery.restaurant.model.MenuItemImage;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface MenuItemImageRepository extends ReactiveCrudRepository<MenuItemImage, Long> {

    Flux<MenuItemImage> findByMenuItemId(Long menuItemId);
}
