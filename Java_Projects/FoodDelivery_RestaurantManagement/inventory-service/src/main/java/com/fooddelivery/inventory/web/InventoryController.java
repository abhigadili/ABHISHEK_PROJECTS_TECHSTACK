package com.fooddelivery.inventory.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.inventory.service.InventoryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Tag(name = "Inventory")
public class InventoryController {
    private static final String OWNER = "hasAnyRole('RESTAURANT_OWNER','RESTAURANT_STAFF','ADMIN','SUPER_ADMIN')";
    private final InventoryService service;

    public InventoryController(InventoryService service) { this.service = service; }

    @PostMapping("/api/inventory/restaurants/{rid}/ingredients")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(OWNER)
    public Dtos.IngredientDto create(@PathVariable Long rid, @Valid @RequestBody Dtos.IngredientRequest r) { return service.create(rid, r); }

    @GetMapping("/api/inventory/restaurants/{rid}/ingredients")
    @PreAuthorize(OWNER)
    public List<Dtos.IngredientDto> list(@PathVariable Long rid) { return service.list(rid); }

    @PutMapping("/api/inventory/ingredients/{id}")
    @PreAuthorize(OWNER)
    public Dtos.IngredientDto update(@PathVariable Long id, @Valid @RequestBody Dtos.IngredientRequest r) { return service.update(id, r); }

    @PostMapping("/api/inventory/ingredients/{id}/restock")
    @PreAuthorize(OWNER)
    public Dtos.IngredientDto restock(@PathVariable Long id, @Valid @RequestBody Dtos.RestockRequest r) { return service.restock(id, r); }

    @PostMapping("/api/inventory/ingredients/{id}/adjust")
    @PreAuthorize(OWNER)
    public Dtos.IngredientDto adjust(@PathVariable Long id, @Valid @RequestBody Dtos.AdjustRequest r) { return service.adjust(id, r); }

    @GetMapping("/api/inventory/ingredients/{id}/history")
    @PreAuthorize(OWNER)
    public PageResponse<Dtos.MovementDto> history(@PathVariable Long id, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.history(id, page, size), m -> m);
    }

    @GetMapping("/api/inventory/restaurants/{rid}/alerts")
    @PreAuthorize(OWNER)
    public List<Dtos.IngredientDto> alerts(@PathVariable Long rid) { return service.alerts(rid); }

    @PutMapping("/api/inventory/restaurants/{rid}/recipes/{menuItemId}")
    @PreAuthorize(OWNER)
    public Dtos.RecipeDto setRecipe(@PathVariable Long rid, @PathVariable Long menuItemId, @Valid @RequestBody Dtos.RecipeRequest r) {
        return service.setRecipe(rid, menuItemId, r.lines());
    }

    @GetMapping("/api/inventory/restaurants/{rid}/recipes")
    @PreAuthorize(OWNER)
    public List<Dtos.RecipeDto> recipes(@PathVariable Long rid) { return service.recipesOf(rid); }

    @GetMapping("/api/inventory/restaurants/{rid}/availability")
    public List<Dtos.Availability> availability(@PathVariable Long rid) { return service.availability(rid); }

    @GetMapping("/api/inventory/overview")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','SERVICE')")
    public Dtos.Overview overview() { return service.overview(); }

    @PostMapping("/internal/inventory/check")
    public Dtos.CheckResponse check(@Valid @RequestBody Dtos.CheckRequest r) { return service.check(r); }
}
