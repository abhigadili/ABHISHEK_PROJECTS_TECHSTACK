package com.fooddelivery.coupon.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.coupon.service.CouponService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Tag(name = "Coupons & Promotions")
public class CouponController {
    private static final String MANAGE = "hasAuthority('PERM_COUPON_MANAGE')";
    private final CouponService service;

    public CouponController(CouponService service) { this.service = service; }

    // ---- public
    @GetMapping("/api/coupons/public/active")
    public List<Dtos.CouponDto> active(@RequestParam(required = false) Long restaurantId) { return service.publicActive(restaurantId); }

    @GetMapping("/api/coupons/public/campaigns")
    public List<Dtos.CampaignDto> campaigns() { return service.activeCampaigns(); }

    // ---- customer: check a code against a subtotal
    @PostMapping("/api/coupons/validate")
    public Dtos.CheckResponse validate(@Valid @RequestBody Dtos.CheckRequest r) { return service.validate(r); }

    // ---- admin
    @PostMapping("/api/coupons")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(MANAGE)
    public Dtos.CouponDto create(@Valid @RequestBody Dtos.CouponRequest r) { return service.create(r); }

    @GetMapping("/api/coupons")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PageResponse<Dtos.CouponDto> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.list(PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt"))), c -> c);
    }

    @PutMapping("/api/coupons/{id}")
    @PreAuthorize(MANAGE)
    public Dtos.CouponDto update(@PathVariable Long id, @Valid @RequestBody Dtos.CouponRequest r) { return service.update(id, r); }

    @PatchMapping("/api/coupons/{id}/active")
    @PreAuthorize(MANAGE)
    public Dtos.CouponDto active(@PathVariable Long id, @RequestBody Dtos.ActiveRequest r) { return service.setActive(id, r.active()); }

    @GetMapping("/api/coupons/{id}/redemptions")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PageResponse<Dtos.RedemptionDto> redemptions(@PathVariable Long id, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.history(id, PageRequest.of(page, Math.min(size, 100))), r -> r);
    }

    @GetMapping("/api/coupons/campaigns")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public List<Dtos.CampaignDto> allCampaigns() { return service.allCampaigns(); }

    @PostMapping("/api/coupons/campaigns")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(MANAGE)
    public Dtos.CampaignDto createCampaign(@Valid @RequestBody Dtos.CampaignRequest r) { return service.createCampaign(r); }

    @PutMapping("/api/coupons/campaigns/{id}")
    @PreAuthorize(MANAGE)
    public Dtos.CampaignDto updateCampaign(@PathVariable Long id, @Valid @RequestBody Dtos.CampaignRequest r) { return service.updateCampaign(id, r); }

    // ---- internal
    @PostMapping("/internal/coupons/validate")
    public Dtos.CheckResponse internalValidate(@Valid @RequestBody Dtos.CheckRequest r) { return service.validate(r); }
}
