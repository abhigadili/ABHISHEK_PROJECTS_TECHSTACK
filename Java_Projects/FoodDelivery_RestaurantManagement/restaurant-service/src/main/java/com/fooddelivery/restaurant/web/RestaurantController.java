package com.fooddelivery.restaurant.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.restaurant.domain.InboxOrder;
import com.fooddelivery.restaurant.domain.Restaurant;
import com.fooddelivery.restaurant.service.InboxService;
import com.fooddelivery.restaurant.service.RestaurantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@Tag(name = "Restaurants")
public class RestaurantController {
    private final RestaurantService service;
    private final InboxService inbox;

    public RestaurantController(RestaurantService service, InboxService inbox) {
        this.service = service;
        this.inbox = inbox;
    }

    // ---------- public ----------
    @Operation(summary = "Search approved restaurants (public)")
    @GetMapping("/api/restaurants")
    public PageResponse<Dtos.RestaurantDto> search(@RequestParam(required = false) String q, @RequestParam(required = false) String cuisine,
                                                   @RequestParam(required = false) String category, @RequestParam(required = false) String city,
                                                   @RequestParam(required = false) Boolean pureVeg, @RequestParam(required = false) Boolean openNow,
                                                   @RequestParam(required = false) Double minRating, @RequestParam(required = false) String sort,
                                                   @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size) {
        return service.search(q, cuisine, category, city, pureVeg, openNow, minRating, sort, page, size);
    }

    @GetMapping("/api/restaurants/nearby")
    public List<Dtos.RestaurantDto> nearby(@RequestParam double lat, @RequestParam double lng,
                                           @RequestParam(defaultValue = "5") double radiusKm, @RequestParam(defaultValue = "20") int limit) {
        return service.nearby(lat, lng, Math.min(radiusKm, 50), Math.min(limit, 50));
    }

    @GetMapping("/api/restaurants/cuisines")
    public List<String> cuisines() { return service.cuisines(); }

    @GetMapping("/api/restaurants/categories")
    public List<String> categories() { return service.categories(); }

    @GetMapping("/api/restaurants/{id}")
    public Dtos.RestaurantDto get(@PathVariable Long id) { return service.get(id); }

    // ---------- owner ----------
    @PostMapping("/api/restaurants")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('RESTAURANT_OWNER')")
    public Dtos.RestaurantDto register(@Valid @RequestBody Dtos.RestaurantRequest r) { return service.register(r); }

    @GetMapping("/api/restaurants/mine")
    @PreAuthorize("hasRole('RESTAURANT_OWNER')")
    public List<Dtos.RestaurantDto> mine() { return service.mine(); }

    @PutMapping("/api/restaurants/{id}")
    @PreAuthorize("hasAnyRole('RESTAURANT_OWNER','ADMIN','SUPER_ADMIN')")
    public Dtos.RestaurantDto update(@PathVariable Long id, @Valid @RequestBody Dtos.RestaurantRequest r) { return service.update(id, r); }

    @PutMapping("/api/restaurants/{id}/hours")
    @PreAuthorize("hasAnyRole('RESTAURANT_OWNER','ADMIN','SUPER_ADMIN')")
    public Dtos.RestaurantDto hours(@PathVariable Long id, @Valid @RequestBody Dtos.HoursRequest r) { return service.setHours(id, r.hours()); }

    @PatchMapping("/api/restaurants/{id}/availability")
    @PreAuthorize("hasAnyRole('RESTAURANT_OWNER','ADMIN','SUPER_ADMIN')")
    public Dtos.RestaurantDto availability(@PathVariable Long id, @RequestBody Dtos.AvailabilityRequest r) { return service.setAvailability(id, r.open()); }

    @PostMapping(value = "/api/restaurants/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('RESTAURANT_OWNER','ADMIN','SUPER_ADMIN')")
    public Dtos.RestaurantDto logo(@PathVariable Long id, @RequestPart("file") MultipartFile file) { return service.uploadLogo(id, file); }

    @PostMapping(value = "/api/restaurants/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('RESTAURANT_OWNER','ADMIN','SUPER_ADMIN')")
    public Dtos.RestaurantDto image(@PathVariable Long id, @RequestPart("file") MultipartFile file) { return service.addImage(id, file); }

    @GetMapping("/api/restaurants/{id}/inbox")
    @PreAuthorize("hasAnyRole('RESTAURANT_OWNER','ADMIN','SUPER_ADMIN')")
    public PageResponse<InboxOrder> inbox(@PathVariable Long id, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(inbox.list(id, page, size), o -> o);
    }

    @GetMapping("/api/restaurants/{id}/sales")
    @PreAuthorize("hasAnyRole('RESTAURANT_OWNER','ADMIN','SUPER_ADMIN')")
    public Dtos.SalesSummary sales(@PathVariable Long id) { return inbox.sales(id); }

    // ---------- admin ----------
    @GetMapping("/api/restaurants/admin/list")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PageResponse<Dtos.RestaurantDto> adminList(@RequestParam(required = false) Restaurant.Status status, @RequestParam(required = false) String q,
                                                      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.adminList(status, q, page, size);
    }

    @GetMapping("/api/restaurants/admin/counts")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','SERVICE')")
    public Map<String, Long> counts() { return service.statusCounts(); }

    @PostMapping("/api/restaurants/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_APPROVE')")
    public Dtos.RestaurantDto approve(@PathVariable Long id) { return service.approve(id); }

    @PostMapping("/api/restaurants/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_APPROVE')")
    public Dtos.RestaurantDto reject(@PathVariable Long id, @RequestBody(required = false) Dtos.ReasonRequest r) {
        return service.changeStatus(id, Restaurant.Status.REJECTED, r == null ? null : r.reason());
    }

    @PostMapping("/api/restaurants/{id}/suspend")
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_APPROVE')")
    public Dtos.RestaurantDto suspend(@PathVariable Long id, @RequestBody(required = false) Dtos.ReasonRequest r) {
        return service.changeStatus(id, Restaurant.Status.SUSPENDED, r == null ? null : r.reason());
    }

    @PostMapping("/api/restaurants/{id}/deactivate")
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_APPROVE')")
    public Dtos.RestaurantDto deactivate(@PathVariable Long id, @RequestBody(required = false) Dtos.ReasonRequest r) {
        return service.changeStatus(id, Restaurant.Status.DEACTIVATED, r == null ? null : r.reason());
    }

    @PostMapping("/api/restaurants/{id}/reactivate")
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_APPROVE')")
    public Dtos.RestaurantDto reactivate(@PathVariable Long id) { return service.approve(id); }

    // ---------- internal ----------
    @GetMapping("/internal/restaurants/{id}")
    public Dtos.RestaurantInfo info(@PathVariable Long id) { return service.info(id); }
}
