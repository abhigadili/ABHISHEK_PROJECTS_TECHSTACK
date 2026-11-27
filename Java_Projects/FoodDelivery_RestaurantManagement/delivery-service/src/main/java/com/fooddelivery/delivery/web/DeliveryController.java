package com.fooddelivery.delivery.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.delivery.domain.Delivery;
import com.fooddelivery.delivery.service.DeliveryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Tag(name = "Delivery")
public class DeliveryController {
    private static final String PARTNER = "hasRole('DELIVERY_PARTNER')";
    private static final String ADMIN = "hasAnyRole('ADMIN','SUPER_ADMIN')";
    private final DeliveryService service;

    public DeliveryController(DeliveryService service) { this.service = service; }

    // ---- delivery partner
    @GetMapping("/api/delivery/me")
    @PreAuthorize(PARTNER)
    public Dtos.PartnerDto me() { return Dtos.PartnerDto.from(service.me()); }

    @PutMapping("/api/delivery/me")
    @PreAuthorize(PARTNER)
    public Dtos.PartnerDto update(@Valid @RequestBody Dtos.ProfileRequest r) { return service.updateProfile(r); }

    @PatchMapping("/api/delivery/me/status")
    @PreAuthorize(PARTNER)
    public Dtos.PartnerDto status(@RequestBody Dtos.OnlineRequest r) { return service.setOnline(r.online()); }

    @PatchMapping("/api/delivery/me/location")
    @PreAuthorize(PARTNER)
    public Dtos.PartnerDto location(@Valid @RequestBody Dtos.LocationRequest r) { return service.updateLocation(r); }

    @GetMapping("/api/delivery/me/current")
    @PreAuthorize(PARTNER)
    public List<Dtos.DeliveryDto> current() { return service.current(); }

    @GetMapping("/api/delivery/me/history")
    @PreAuthorize(PARTNER)
    public PageResponse<Dtos.DeliveryDto> history(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.history(page, size), d -> d);
    }

    @GetMapping("/api/delivery/me/performance")
    @PreAuthorize(PARTNER)
    public Dtos.Performance performance() { return service.performance(); }

    @PostMapping("/api/delivery/{id}/accept")
    @PreAuthorize(PARTNER)
    public Dtos.DeliveryDto accept(@PathVariable Long id) { return service.accept(id); }

    @PostMapping("/api/delivery/{id}/reject")
    @PreAuthorize(PARTNER)
    public Dtos.DeliveryDto reject(@PathVariable Long id, @RequestBody(required = false) Dtos.ReasonRequest r) { return service.reject(id, r == null ? null : r.reason()); }

    @PostMapping("/api/delivery/{id}/pickup")
    @PreAuthorize(PARTNER)
    public Dtos.DeliveryDto pickup(@PathVariable Long id) { return service.pickup(id); }

    @PostMapping("/api/delivery/{id}/complete")
    @PreAuthorize(PARTNER)
    public Dtos.DeliveryDto complete(@PathVariable Long id) { return service.complete(id); }

    // ---- customer / admin tracking
    @GetMapping("/api/delivery/order/{orderId}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN','SUPER_ADMIN','RESTAURANT_OWNER')")
    public Dtos.DeliveryDto forOrder(@PathVariable Long orderId) { return service.forOrder(orderId); }

    // ---- admin
    @GetMapping("/api/delivery")
    @PreAuthorize(ADMIN)
    public PageResponse<Dtos.DeliveryDto> list(@RequestParam(required = false) Delivery.Status status, @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.list(status, page, size), d -> d);
    }

    @GetMapping("/api/delivery/{id}/trail")
    @PreAuthorize(ADMIN)
    public List<Dtos.LogDto> trail(@PathVariable Long id) { return service.trail(id); }

    @GetMapping("/api/delivery/partners")
    @PreAuthorize(ADMIN)
    public List<Dtos.PartnerDto> partners() { return service.allPartners(); }

    @PatchMapping("/api/delivery/partners/{userId}/suspended")
    @PreAuthorize(ADMIN)
    public Dtos.PartnerDto suspend(@PathVariable Long userId, @RequestParam boolean value) { return service.setSuspended(userId, value); }

    @GetMapping("/api/delivery/overview")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','SERVICE')")
    public Dtos.Overview overview() { return service.overview(); }
}
