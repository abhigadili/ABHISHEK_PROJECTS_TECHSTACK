package com.fooddelivery.restaurant.service;

import com.fooddelivery.restaurant.exception.ResourceNotFoundException;
import com.fooddelivery.restaurant.model.MenuItemImage;
import com.fooddelivery.restaurant.repository.MenuItemImageRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class MenuItemImageService {

    private final MenuItemImageRepository menuItemImageRepository;

    public MenuItemImageService(MenuItemImageRepository menuItemImageRepository) {
        this.menuItemImageRepository = menuItemImageRepository;
    }

    public Flux<MenuItemImage> findAll(Long menuItemId) {
        return menuItemId != null
                ? menuItemImageRepository.findByMenuItemId(menuItemId)
                : menuItemImageRepository.findAll();
    }

    public Mono<MenuItemImage> findById(Long id) {
        return menuItemImageRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Menu item image not found: " + id)));
    }

    public Mono<MenuItemImage> create(MenuItemImage image) {
        MenuItemImage toSave = new MenuItemImage(null, image.menuItemId(), image.imageUrl(), image.isPrimary(), null);
        return menuItemImageRepository.save(toSave)
                .flatMap(saved -> menuItemImageRepository.findById(saved.imageId()));
    }

    public Mono<MenuItemImage> update(Long id, MenuItemImage image) {
        return findById(id)
                .map(existing -> new MenuItemImage(id, image.menuItemId(), image.imageUrl(), image.isPrimary(), existing.uploadedAt()))
                .flatMap(menuItemImageRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(menuItemImageRepository::delete);
    }
}
