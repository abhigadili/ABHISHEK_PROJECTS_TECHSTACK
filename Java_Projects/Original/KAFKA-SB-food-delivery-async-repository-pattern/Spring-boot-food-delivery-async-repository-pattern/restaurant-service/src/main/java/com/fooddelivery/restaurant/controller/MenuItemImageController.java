package com.fooddelivery.restaurant.controller;

import com.fooddelivery.restaurant.model.MenuItemImage;
import com.fooddelivery.restaurant.service.MenuItemImageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/menu-item-images")
public class MenuItemImageController {

    private final MenuItemImageService menuItemImageService;

    public MenuItemImageController(MenuItemImageService menuItemImageService) {
        this.menuItemImageService = menuItemImageService;
    }

    @GetMapping
    public Flux<MenuItemImage> findAll(@RequestParam(required = false) Long menuItemId) {
        return menuItemImageService.findAll(menuItemId);
    }

    @GetMapping("/{id}")
    public Mono<MenuItemImage> findById(@PathVariable Long id) {
        return menuItemImageService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MenuItemImage> create(@Valid @RequestBody MenuItemImage image) {
        return menuItemImageService.create(image);
    }

    @PutMapping("/{id}")
    public Mono<MenuItemImage> update(@PathVariable Long id, @Valid @RequestBody MenuItemImage image) {
        return menuItemImageService.update(id, image);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return menuItemImageService.delete(id);
    }
}
