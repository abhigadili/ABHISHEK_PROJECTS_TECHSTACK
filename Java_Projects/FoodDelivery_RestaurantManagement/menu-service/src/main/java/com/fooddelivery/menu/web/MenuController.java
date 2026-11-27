package com.fooddelivery.menu.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.menu.service.MenuService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;

@RestController
@Tag(name = "Menu")
public class MenuController {
    private static final String OWNER = "hasAnyRole('RESTAURANT_OWNER','RESTAURANT_STAFF','ADMIN','SUPER_ADMIN')";
    private final MenuService menu;

    public MenuController(MenuService menu) { this.menu = menu; }

    // ---------- public ----------
    @GetMapping("/api/menu/restaurants/{restaurantId}")
    public Dtos.MenuDto menu(@PathVariable Long restaurantId) { return menu.menu(restaurantId); }

    @GetMapping("/api/menu/items/{id}")
    public Dtos.ItemDto item(@PathVariable Long id) { return menu.item(id); }

    @GetMapping("/api/menu/items")
    public PageResponse<Dtos.ItemDto> search(@RequestParam(required = false) Long restaurantId, @RequestParam(required = false) String category,
                                             @RequestParam(required = false) String q, @RequestParam(required = false) Boolean vegetarian,
                                             @RequestParam(required = false) BigDecimal minPrice, @RequestParam(required = false) BigDecimal maxPrice,
                                             @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return menu.search(restaurantId, category, q, vegetarian, minPrice, maxPrice, page, size);
    }

    @GetMapping("/api/menu/popular")
    public List<Dtos.ItemDto> popular(@RequestParam(required = false) Long restaurantId, @RequestParam(defaultValue = "10") int limit) {
        return menu.popular(restaurantId, Math.min(limit, 30));
    }

    // ---------- owner ----------
    @PostMapping("/api/menu/restaurants/{restaurantId}/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(OWNER)
    public Dtos.CategoryDto createCategory(@PathVariable Long restaurantId, @Valid @RequestBody Dtos.CategoryRequest r) { return menu.createCategory(restaurantId, r); }

    @PutMapping("/api/menu/categories/{id}")
    @PreAuthorize(OWNER)
    public Dtos.CategoryDto updateCategory(@PathVariable Long id, @Valid @RequestBody Dtos.CategoryRequest r) { return menu.updateCategory(id, r); }

    @DeleteMapping("/api/menu/categories/{id}")
    @PreAuthorize(OWNER)
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        menu.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/menu/restaurants/{restaurantId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(OWNER)
    public Dtos.ItemDto createItem(@PathVariable Long restaurantId, @Valid @RequestBody Dtos.ItemRequest r) { return menu.createItem(restaurantId, r); }

    @PutMapping("/api/menu/items/{id}")
    @PreAuthorize(OWNER)
    public Dtos.ItemDto updateItem(@PathVariable Long id, @Valid @RequestBody Dtos.ItemRequest r) { return menu.updateItem(id, r); }

    @PatchMapping("/api/menu/items/{id}/availability")
    @PreAuthorize(OWNER)
    public Dtos.ItemDto availability(@PathVariable Long id, @RequestBody Dtos.AvailabilityRequest r) { return menu.setAvailability(id, r.available()); }

    @DeleteMapping("/api/menu/items/{id}")
    @PreAuthorize(OWNER)
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        menu.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/api/menu/items/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(OWNER)
    public Dtos.ItemDto image(@PathVariable Long id, @RequestPart("file") MultipartFile file) { return menu.uploadImage(id, file); }

    // ---------- internal ----------
    @PostMapping("/internal/menu/validate")
    public Dtos.ValidateResponse validate(@Valid @RequestBody Dtos.ValidateRequest r) { return menu.validate(r); }

    @GetMapping("/internal/menu/items/{id}")
    public Dtos.ItemInfo info(@PathVariable Long id) { return menu.info(id); }
}
