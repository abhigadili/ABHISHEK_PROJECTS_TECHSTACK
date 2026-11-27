package com.fooddelivery.restaurant.service;

import com.fooddelivery.restaurant.exception.ResourceNotFoundException;
import com.fooddelivery.restaurant.model.MenuItem;
import com.fooddelivery.restaurant.repository.MenuItemRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class MenuItemService {

    private final MenuItemRepository menuItemRepository;

    public MenuItemService(MenuItemRepository menuItemRepository) {
        this.menuItemRepository = menuItemRepository;
    }

    public Flux<MenuItem> findAll(Long restaurantId, Long categoryId) {
        if (restaurantId != null) {
            return menuItemRepository.findByRestaurantId(restaurantId);
        }
        if (categoryId != null) {
            return menuItemRepository.findByCategoryId(categoryId);
        }
        return menuItemRepository.findAll();
    }

    public Mono<MenuItem> findById(Long id) {
        return menuItemRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Menu item not found: " + id)));
    }

    public Mono<MenuItem> create(MenuItem menuItem) {
        MenuItem toSave = new MenuItem(null, menuItem.restaurantId(), menuItem.categoryId(),
                menuItem.name(), menuItem.description(), menuItem.price(),
                menuItem.isVegetarian(), menuItem.isAvailable(), null);
        // Re-fetch after insert so createdAt (a DB-side DEFAULT) is populated in the response.
        return menuItemRepository.save(toSave)
                .flatMap(saved -> menuItemRepository.findById(saved.menuItemId()));
    }

    public Mono<MenuItem> update(Long id, MenuItem menuItem) {
        return findById(id)
                .map(existing -> new MenuItem(id, menuItem.restaurantId(), menuItem.categoryId(),
                        menuItem.name(), menuItem.description(), menuItem.price(),
                        menuItem.isVegetarian(), menuItem.isAvailable(), existing.createdAt()))
                .flatMap(menuItemRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(menuItemRepository::delete);
    }
}
