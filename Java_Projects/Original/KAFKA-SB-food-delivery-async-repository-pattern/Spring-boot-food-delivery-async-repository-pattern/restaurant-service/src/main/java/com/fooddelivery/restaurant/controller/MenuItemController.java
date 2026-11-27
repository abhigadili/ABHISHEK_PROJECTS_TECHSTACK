package com.fooddelivery.restaurant.controller;

import com.fooddelivery.restaurant.model.MenuItem;
import com.fooddelivery.restaurant.service.MenuItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/menu-items")
public class MenuItemController {

    private final MenuItemService menuItemService;

    public MenuItemController(MenuItemService menuItemService) {
        this.menuItemService = menuItemService;
    }

    @GetMapping
    public Flux<MenuItem> findAll(@RequestParam(required = false) Long restaurantId,
                                   @RequestParam(required = false) Long categoryId) {
        return menuItemService.findAll(restaurantId, categoryId);
    }

    @GetMapping("/{id}")
    public Mono<MenuItem> findById(@PathVariable Long id) {
        return menuItemService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MenuItem> create(@Valid @RequestBody MenuItem menuItem) {
        return menuItemService.create(menuItem);
    }

    @PutMapping("/{id}")
    public Mono<MenuItem> update(@PathVariable Long id, @Valid @RequestBody MenuItem menuItem) {
        return menuItemService.update(id, menuItem);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return menuItemService.delete(id);
    }
}
