package com.fooddelivery.restaurant.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.file.FileStorageService;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.restaurant.domain.OpeningHour;
import com.fooddelivery.restaurant.domain.Restaurant;
import com.fooddelivery.restaurant.event.RestaurantEventProducer;
import com.fooddelivery.restaurant.repository.RestaurantRepository;
import com.fooddelivery.restaurant.web.Dtos;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Restaurant business logic.
 * Cache strategy (Redis): details cached per id for 10 min ("restaurant"), listings for 2 min ("restaurant-list"),
 * cuisines/categories 30 min. Every write evicts the affected detail entry and the whole listing cache.
 */
@Service
public class RestaurantService {
    private static final Logger log = LoggerFactory.getLogger(RestaurantService.class);
    private final RestaurantRepository repo;
    private final RestaurantEventProducer events;
    private final FileStorageService storage;
    private final com.fooddelivery.common.cache.CacheEvictor evictor;

    public RestaurantService(RestaurantRepository repo, RestaurantEventProducer events, FileStorageService storage,
                             com.fooddelivery.common.cache.CacheEvictor evictor) {
        this.evictor = evictor;
        this.repo = repo;
        this.events = events;
        this.storage = storage;
    }

    // ------------------------------------------------------------------ owner operations
    @Audited("RESTAURANT_REGISTER")
    @Transactional
    @CacheEvict(cacheNames = "restaurant-list", allEntries = true)
    public Dtos.RestaurantDto register(Dtos.RestaurantRequest r) {
        AuthUser u = SecurityUtils.requireUser();
        Restaurant e = new Restaurant();
        e.setOwnerUserId(u.userId());
        apply(e, r);
        e.setStatus(Restaurant.Status.PENDING);
        repo.save(e);
        events.registered(e);
        log.info("Restaurant registered id={} owner={}", e.getId(), u.userId());
        return Dtos.RestaurantDto.from(e, null);
    }

    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "restaurant", key = "#id"), @CacheEvict(cacheNames = "restaurant-list", allEntries = true)})
    public Dtos.RestaurantDto update(Long id, Dtos.RestaurantRequest r) {
        Restaurant e = owned(id);
        apply(e, r);
        if (e.getStatus() == Restaurant.Status.REJECTED) e.setStatus(Restaurant.Status.PENDING);  // resubmission
        return Dtos.RestaurantDto.from(e, null);
    }

    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "restaurant", key = "#id"), @CacheEvict(cacheNames = "restaurant-list", allEntries = true)})
    public Dtos.RestaurantDto setHours(Long id, List<Dtos.HourDto> hours) {
        Restaurant e = owned(id);
        Set<java.time.DayOfWeek> seen = new HashSet<>();
        for (var h : hours) {
            if (!seen.add(h.dayOfWeek())) throw new BadRequestException("Duplicate day " + h.dayOfWeek());
            if (!h.closed() && (h.opensAt() == null || h.closesAt() == null)) throw new BadRequestException("opensAt/closesAt required for " + h.dayOfWeek());
        }
        e.getHours().clear();                       // orphanRemoval deletes the old rows
        repo.flush();
        for (var h : hours) {
            OpeningHour o = new OpeningHour();
            o.setRestaurant(e);
            o.setDayOfWeek(h.dayOfWeek());
            o.setOpensAt(h.opensAt());
            o.setClosesAt(h.closesAt());
            o.setClosed(h.closed());
            e.getHours().add(o);
        }
        return Dtos.RestaurantDto.from(e, null);
    }

    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "restaurant", key = "#id"), @CacheEvict(cacheNames = "restaurant-list", allEntries = true)})
    public Dtos.RestaurantDto setAvailability(Long id, boolean open) {
        Restaurant e = owned(id);
        e.setOpen(open);
        return Dtos.RestaurantDto.from(e, null);
    }

    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "restaurant", key = "#id"), @CacheEvict(cacheNames = "restaurant-list", allEntries = true)})
    public Dtos.RestaurantDto uploadLogo(Long id, MultipartFile file) {
        Restaurant e = owned(id);
        String old = e.getLogoUrl();
        e.setLogoUrl(storage.store(file, "restaurants"));
        storage.delete(old);
        return Dtos.RestaurantDto.from(e, null);
    }

    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "restaurant", key = "#id"), @CacheEvict(cacheNames = "restaurant-list", allEntries = true)})
    public Dtos.RestaurantDto addImage(Long id, MultipartFile file) {
        Restaurant e = owned(id);
        if (e.getImageUrls().size() >= 8) throw new ConflictException("At most 8 images per restaurant");
        e.getImageUrls().add(storage.store(file, "restaurants"));
        return Dtos.RestaurantDto.from(e, null);
    }

    @Transactional(readOnly = true)
    public List<Dtos.RestaurantDto> mine() {
        return repo.findByOwnerUserId(SecurityUtils.requireUser().userId()).stream().map(r -> {
            Restaurant d = repo.findDetailed(r.getId()).orElse(r);
            return Dtos.RestaurantDto.from(d, null);
        }).toList();
    }

    // ------------------------------------------------------------------ admin operations
    @Audited("RESTAURANT_APPROVE")
    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "restaurant", key = "#id"), @CacheEvict(cacheNames = "restaurant-list", allEntries = true),
            @CacheEvict(cacheNames = "restaurant-cuisines", allEntries = true)})
    public Dtos.RestaurantDto approve(Long id) {
        Restaurant e = detailed(id);
        if (e.getStatus() == Restaurant.Status.APPROVED) throw new ConflictException("Restaurant is already approved");
        e.setStatus(Restaurant.Status.APPROVED);
        e.setApprovedAt(Instant.now());
        e.setApprovedBy(SecurityUtils.requireUser().username());
        e.setStatusReason(null);
        events.approved(e, "RestaurantApproved");
        return Dtos.RestaurantDto.from(e, null);
    }

    @Audited("RESTAURANT_STATUS")
    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "restaurant", key = "#id"), @CacheEvict(cacheNames = "restaurant-list", allEntries = true),
            @CacheEvict(cacheNames = "restaurant-cuisines", allEntries = true)})
    public Dtos.RestaurantDto changeStatus(Long id, Restaurant.Status status, String reason) {
        Restaurant e = detailed(id);
        if (status == Restaurant.Status.APPROVED || status == Restaurant.Status.PENDING) throw new BadRequestException("Use approve for approvals");
        e.setStatus(status);
        e.setStatusReason(reason);
        if (status == Restaurant.Status.SUSPENDED || status == Restaurant.Status.DEACTIVATED || status == Restaurant.Status.REJECTED) {
            events.approved(e, "Restaurant" + status.name().charAt(0) + status.name().substring(1).toLowerCase());   // search index removes non-approved
        }
        return Dtos.RestaurantDto.from(e, null);
    }

    @Transactional(readOnly = true)
    public PageResponse<Dtos.RestaurantDto> adminList(Restaurant.Status status, String q, int page, int size) {
        Specification<Restaurant> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (status != null) p.add(cb.equal(root.get("status"), status));
            if (q != null && !q.isBlank()) p.add(cb.like(cb.lower(root.get("name")), "%" + q.toLowerCase().trim() + "%"));
            return cb.and(p.toArray(Predicate[]::new));
        };
        Page<Restaurant> pg = repo.findAll(spec, PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        pg.getContent().forEach(r -> r.getCuisines().size());      // initialise inside the transaction
        return PageResponse.of(pg, r -> Dtos.RestaurantDto.from(r, null));
    }

    @Transactional(readOnly = true)
    public Map<String, Long> statusCounts() {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Restaurant.Status s : Restaurant.Status.values()) m.put(s.name(), repo.countByStatus(s));
        return m;
    }

    // ------------------------------------------------------------------ public reads (cached)
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "restaurant", key = "#id")
    public Dtos.RestaurantDto get(Long id) {
        Restaurant r = detailed(id);
        AuthUser u = SecurityUtils.currentUser().orElse(null);
        boolean privileged = u != null && (u.isAdmin() || u.userId() == r.getOwnerUserId());
        if (r.getStatus() != Restaurant.Status.APPROVED && !privileged) throw new NotFoundException("Restaurant", id);
        return Dtos.RestaurantDto.from(r, null);
    }

    /**
     * Search with Criteria-API Specifications + pagination. Cached for 2 minutes per distinct filter combination;
     * all entries are evicted on any restaurant change (simple and safe: the listing is cheap to rebuild).
     */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "restaurant-list", key = "T(java.util.Objects).hash(#q,#cuisine,#category,#city,#pureVeg,#openNow,#minRating,#sort,#page,#size)")
    public PageResponse<Dtos.RestaurantDto> search(String q, String cuisine, String category, String city, Boolean pureVeg,
                                                   Boolean openNow, Double minRating, String sort, int page, int size) {
        Specification<Restaurant> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            p.add(cb.equal(root.get("status"), Restaurant.Status.APPROVED));
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase().trim() + "%";
                query.distinct(true);
                jakarta.persistence.criteria.Join<Restaurant, String> cu = root.join("cuisines", JoinType.LEFT);
                p.add(cb.or(cb.like(cb.lower(root.get("name")), like), cb.like(cb.lower(cu), like), cb.like(cb.lower(root.get("city")), like)));
            }
            if (cuisine != null && !cuisine.isBlank()) { query.distinct(true); jakarta.persistence.criteria.Join<Restaurant, String> cj = root.join("cuisines", JoinType.LEFT); p.add(cb.equal(cb.lower(cj), cuisine.toLowerCase())); }
            if (category != null && !category.isBlank()) p.add(cb.equal(cb.lower(root.get("category")), category.toLowerCase()));
            if (city != null && !city.isBlank()) p.add(cb.equal(cb.lower(root.get("city")), city.toLowerCase()));
            if (Boolean.TRUE.equals(pureVeg)) p.add(cb.isTrue(root.get("pureVeg")));
            if (minRating != null) p.add(cb.greaterThanOrEqualTo(root.get("avgRating"), BigDecimal.valueOf(minRating)));
            return cb.and(p.toArray(Predicate[]::new));
        };
        Sort s = switch (sort == null ? "rating" : sort) {
            case "name" -> Sort.by("name");
            case "delivery" -> Sort.by("prepTimeMinutes");
            case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt");
            default -> Sort.by(Sort.Direction.DESC, "avgRating").and(Sort.by("name"));
        };
        Page<Restaurant> pg = repo.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), s));
        pg.getContent().forEach(r -> { r.getCuisines().size(); r.getHours().size(); r.getImageUrls().size(); });
        var dto = PageResponse.of(pg, r -> Dtos.RestaurantDto.from(r, null));
        if (Boolean.TRUE.equals(openNow)) {
            var open = dto.content().stream().filter(Dtos.RestaurantDto::openNow).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
            return new PageResponse<>(open, dto.page(), dto.size(), open.size(), dto.totalPages());
        }
        return new PageResponse<>(new ArrayList<>(dto.content()), dto.page(), dto.size(), dto.totalElements(), dto.totalPages());
    }

    @Transactional(readOnly = true)
    public List<Dtos.RestaurantDto> nearby(double lat, double lng, double radiusKm, int limit) {
        double dLat = radiusKm / 111.0;
        double dLng = radiusKm / (111.0 * Math.max(0.01, Math.cos(Math.toRadians(lat))));
        List<Dtos.RestaurantDto> out = new ArrayList<>();
        for (Restaurant r : repo.findInBox(lat - dLat, lat + dLat, lng - dLng, lng + dLng)) {
            double d = haversineKm(lat, lng, r.getLatitude(), r.getLongitude());
            if (d <= radiusKm) {
                r.getCuisines().size(); r.getHours().size(); r.getImageUrls().size();
                out.add(Dtos.RestaurantDto.from(r, Math.round(d * 10.0) / 10.0));
            }
        }
        out.sort(Comparator.comparing(Dtos.RestaurantDto::distanceKm));
        return out.size() > limit ? new ArrayList<>(out.subList(0, limit)) : out;
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "restaurant-cuisines", key = "'cuisines'")
    public ArrayList<String> cuisines() { return new ArrayList<>(repo.findApprovedCuisines()); }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "restaurant-cuisines", key = "'categories'")
    public ArrayList<String> categories() { return new ArrayList<>(repo.findApprovedCategories()); }

    // ------------------------------------------------------------------ internal
    @Transactional(readOnly = true)
    public Dtos.RestaurantInfo info(Long id) { return Dtos.RestaurantInfo.from(detailed(id)); }

    @Transactional
    public void applyRating(Long id, double avg, long count) {
        repo.findById(id).ifPresent(r -> {
            r.setAvgRating(BigDecimal.valueOf(avg).setScale(2, java.math.RoundingMode.HALF_UP));
            r.setRatingCount(count);
        });
        evictor.evict("restaurant", id);          // after the consumer's transaction commits (see CacheEvictor)
        evictor.clear("restaurant-list");
    }

    // ------------------------------------------------------------------ helpers
    public Restaurant owned(Long id) {
        Restaurant e = detailed(id);
        AuthUser u = SecurityUtils.requireUser();
        if (!u.isAdmin() && u.userId() != e.getOwnerUserId()) throw new ForbiddenException("This is not your restaurant");
        return e;
    }

    private Restaurant detailed(Long id) { return repo.findDetailed(id).orElseThrow(() -> new NotFoundException("Restaurant", id)); }

    private void apply(Restaurant e, Dtos.RestaurantRequest r) {
        e.setName(r.name().trim());
        e.setDescription(r.description());
        e.setCategory(r.category());
        e.getCuisines().clear();
        r.cuisines().forEach(c -> e.getCuisines().add(c.trim()));
        e.setPureVeg(r.pureVeg());
        e.setPhone(r.phone());
        e.setEmail(r.email());
        e.setAddressLine(r.addressLine());
        e.setCity(r.city());
        e.setState(r.state());
        e.setPostalCode(r.postalCode());
        e.setLatitude(r.latitude());
        e.setLongitude(r.longitude());
        if (r.minOrderAmount() != null) e.setMinOrderAmount(r.minOrderAmount());
        if (r.deliveryFee() != null) e.setDeliveryFee(r.deliveryFee());
        if (r.prepTimeMinutes() != null) e.setPrepTimeMinutes(r.prepTimeMinutes());
    }

    static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
