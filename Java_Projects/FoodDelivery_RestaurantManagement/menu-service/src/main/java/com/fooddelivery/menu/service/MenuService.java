package com.fooddelivery.menu.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.file.FileStorageService;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.menu.client.RestaurantGateway;
import com.fooddelivery.menu.domain.*;
import com.fooddelivery.menu.event.MenuEventProducer;
import com.fooddelivery.menu.repository.*;
import com.fooddelivery.menu.web.Dtos;
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.cache.CacheManager;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Menu management. Redis: "menu" (a restaurant's whole menu), "menu-item" (single item), "menu-popular".
 * Every write evicts the restaurant's menu entry and the item entry, then a Kafka event is queued (outbox) so
 * other services (search, inventory) learn about the change.
 */
@Service
public class MenuService {
    private static final Logger log = LoggerFactory.getLogger(MenuService.class);
    private final MenuCategoryRepository categories;
    private final MenuItemRepository items;
    private final ItemPopularityRepository popularity;
    private final RestaurantGateway restaurants;
    private final MenuEventProducer events;
    private final FileStorageService storage;
    private final CacheManager cacheManager;

    public MenuService(MenuCategoryRepository categories, MenuItemRepository items, ItemPopularityRepository popularity,
                       RestaurantGateway restaurants, MenuEventProducer events, FileStorageService storage, CacheManager cacheManager) {
        this.cacheManager = cacheManager;
        this.categories = categories;
        this.items = items;
        this.popularity = popularity;
        this.restaurants = restaurants;
        this.events = events;
        this.storage = storage;
    }

    // ------------------------------------------------------------------ categories
    @Transactional
    @CacheEvict(cacheNames = "menu", key = "#restaurantId")
    public Dtos.CategoryDto createCategory(Long restaurantId, Dtos.CategoryRequest r) {
        restaurants.requireOwnerOrAdmin(restaurantId, SecurityUtils.requireUser());
        if (categories.existsByRestaurantIdAndNameIgnoreCase(restaurantId, r.name().trim())) throw new ConflictException("Category already exists");
        MenuCategory c = new MenuCategory();
        c.setRestaurantId(restaurantId);
        c.setName(r.name().trim());
        c.setDescription(r.description());
        c.setDisplayOrder(r.displayOrder() == null ? 0 : r.displayOrder());
        categories.save(c);
        return Dtos.CategoryDto.from(c, new ArrayList<>());
    }

    @Transactional
    public Dtos.CategoryDto updateCategory(Long id, Dtos.CategoryRequest r) {
        MenuCategory c = category(id);
        restaurants.requireOwnerOrAdmin(c.getRestaurantId(), SecurityUtils.requireUser());
        c.setName(r.name().trim());
        c.setDescription(r.description());
        if (r.displayOrder() != null) c.setDisplayOrder(r.displayOrder());
        evictMenu(c.getRestaurantId());
        return Dtos.CategoryDto.from(c, new ArrayList<>());
    }

    @Transactional
    public void deleteCategory(Long id) {
        MenuCategory c = category(id);
        restaurants.requireOwnerOrAdmin(c.getRestaurantId(), SecurityUtils.requireUser());
        long live = items.findMenu(c.getRestaurantId()).stream().filter(i -> i.getCategory().getId().equals(id)).count();
        if (live > 0) throw new ConflictException("Category still contains " + live + " items; move or remove them first");
        c.setActive(false);
        evictMenu(c.getRestaurantId());
    }

    // ------------------------------------------------------------------ items
    @Audited("MENU_ITEM_CREATE")
    @Transactional
    @CacheEvict(cacheNames = "menu", key = "#restaurantId")
    public Dtos.ItemDto createItem(Long restaurantId, Dtos.ItemRequest r) {
        restaurants.requireOwnerOrAdmin(restaurantId, SecurityUtils.requireUser());
        MenuCategory c = category(r.categoryId());
        if (!c.getRestaurantId().equals(restaurantId)) throw new BadRequestException("Category belongs to another restaurant");
        MenuItem i = new MenuItem();
        i.setRestaurantId(restaurantId);
        apply(i, c, r);
        items.save(i);
        events.created(i);
        log.info("Menu item created id={} restaurant={}", i.getId(), restaurantId);
        return Dtos.ItemDto.from(i);
    }

    @Audited("MENU_ITEM_UPDATE")
    @Transactional
    @Caching(evict = {@CacheEvict(cacheNames = "menu-item", key = "#id"), @CacheEvict(cacheNames = "menu-popular", allEntries = true)})
    public Dtos.ItemDto updateItem(Long id, Dtos.ItemRequest r) {
        MenuItem i = detailed(id);
        restaurants.requireOwnerOrAdmin(i.getRestaurantId(), SecurityUtils.requireUser());
        MenuCategory c = category(r.categoryId());
        if (!c.getRestaurantId().equals(i.getRestaurantId())) throw new BadRequestException("Category belongs to another restaurant");
        apply(i, c, r);
        events.updated(i);
        evictMenu(i.getRestaurantId());
        return Dtos.ItemDto.from(i);
    }

    @Transactional
    @CacheEvict(cacheNames = "menu-item", key = "#id")
    public Dtos.ItemDto setAvailability(Long id, boolean available) {
        MenuItem i = detailed(id);
        restaurants.requireOwnerOrAdmin(i.getRestaurantId(), SecurityUtils.requireUser());
        i.setAvailable(available);
        events.updated(i);
        evictMenu(i.getRestaurantId());
        return Dtos.ItemDto.from(i);
    }

    /** Soft delete: the row stays for order history but disappears from every menu and cannot be ordered. */
    @Audited("MENU_ITEM_DEACTIVATE")
    @Transactional
    @CacheEvict(cacheNames = "menu-item", key = "#id")
    public void deactivate(Long id) {
        MenuItem i = detailed(id);
        restaurants.requireOwnerOrAdmin(i.getRestaurantId(), SecurityUtils.requireUser());
        i.setActive(false);
        events.updated(i);
        evictMenu(i.getRestaurantId());
    }

    @Transactional
    @CacheEvict(cacheNames = "menu-item", key = "#id")
    public Dtos.ItemDto uploadImage(Long id, MultipartFile file) {
        MenuItem i = detailed(id);
        restaurants.requireOwnerOrAdmin(i.getRestaurantId(), SecurityUtils.requireUser());
        String old = i.getImageUrl();
        i.setImageUrl(storage.store(file, "menu"));
        storage.delete(old);
        events.updated(i);
        evictMenu(i.getRestaurantId());
        return Dtos.ItemDto.from(i);
    }

    // ------------------------------------------------------------------ reads
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "menu", key = "#restaurantId")
    public Dtos.MenuDto menu(Long restaurantId) {
        Map<Long, ArrayList<Dtos.ItemDto>> byCat = new LinkedHashMap<>();
        for (MenuItem i : items.findMenu(restaurantId)) {
            i.getAddOns().size();    // second collection loaded lazily inside the transaction (batch fetch size 16)
            byCat.computeIfAbsent(i.getCategory().getId(), k -> new ArrayList<>()).add(Dtos.ItemDto.from(i));
        }
        ArrayList<Dtos.CategoryDto> cats = categories.findByRestaurantIdAndActiveTrueOrderByDisplayOrderAscNameAsc(restaurantId).stream()
                .map(c -> Dtos.CategoryDto.from(c, byCat.getOrDefault(c.getId(), new ArrayList<>())))
                .collect(Collectors.toCollection(ArrayList::new));
        int total = cats.stream().mapToInt(c -> c.items().size()).sum();
        return new Dtos.MenuDto(restaurantId, cats, total);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "menu-item", key = "#id")
    public Dtos.ItemDto item(Long id) {
        MenuItem i = detailed(id);
        if (!i.isActive()) throw new NotFoundException("Menu item", id);
        return Dtos.ItemDto.from(i);
    }

    /** Filtered, paginated item search (Specifications). */
    @Transactional(readOnly = true)
    public PageResponse<Dtos.ItemDto> search(Long restaurantId, String category, String q, Boolean vegetarian, BigDecimal minPrice,
                                             BigDecimal maxPrice, int page, int size) {
        Specification<MenuItem> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            p.add(cb.isTrue(root.get("active")));
            if (restaurantId != null) p.add(cb.equal(root.get("restaurantId"), restaurantId));
            if (category != null && !category.isBlank()) p.add(cb.equal(cb.lower(root.get("category").get("name")), category.toLowerCase()));
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase().trim() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("name")), like), cb.like(cb.lower(root.get("description")), like), cb.like(cb.lower(root.get("tags")), like)));
            }
            if (vegetarian != null) p.add(cb.equal(root.get("vegetarian"), vegetarian));
            if (minPrice != null) p.add(cb.greaterThanOrEqualTo(root.get("basePrice"), minPrice));
            if (maxPrice != null) p.add(cb.lessThanOrEqualTo(root.get("basePrice"), maxPrice));
            return cb.and(p.toArray(Predicate[]::new));
        };
        Page<MenuItem> pg = items.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), Sort.by("name")));
        pg.getContent().forEach(i -> { i.getCategory().getName(); i.getVariants().size(); i.getAddOns().size(); });
        return PageResponse.of(pg, Dtos.ItemDto::from);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "menu-popular", key = "(#restaurantId == null ? 'all' : #restaurantId) + ':' + #limit")
    public ArrayList<Dtos.ItemDto> popular(Long restaurantId, int limit) {
        var top = restaurantId == null ? popularity.findAllByOrderByOrderedQuantityDesc(PageRequest.of(0, limit))
                : popularity.findByRestaurantIdOrderByOrderedQuantityDesc(restaurantId, PageRequest.of(0, limit));
        Map<Long, MenuItem> byId = items.findAllDetailed(top.stream().map(ItemPopularity::getMenuItemId).toList()).stream()
                .collect(Collectors.toMap(MenuItem::getId, x -> x));
        return top.stream().map(p -> byId.get(p.getMenuItemId())).filter(i -> i != null && i.isActive() && i.isAvailable())
                .map(Dtos.ItemDto::from).collect(Collectors.toCollection(ArrayList::new));
    }

    // ------------------------------------------------------------------ internal: authoritative price validation
    @Transactional(readOnly = true)
    public Dtos.ValidateResponse validate(Dtos.ValidateRequest req) {
        Map<Long, MenuItem> byId = items.findAllDetailed(req.lines().stream().map(Dtos.LineRequest::menuItemId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(MenuItem::getId, x -> x));
        List<Dtos.PricedLine> out = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        int prep = 0;
        for (Dtos.LineRequest l : req.lines()) {
            MenuItem i = byId.get(l.menuItemId());
            if (i == null || !i.isActive()) throw new BadRequestException("ITEM_UNAVAILABLE", "Menu item " + l.menuItemId() + " no longer exists");
            if (!i.getRestaurantId().equals(req.restaurantId())) throw new BadRequestException("ITEM_WRONG_RESTAURANT", "'" + i.getName() + "' does not belong to this restaurant");
            if (!i.isAvailable()) throw new BadRequestException("ITEM_UNAVAILABLE", "'" + i.getName() + "' is currently unavailable");
            BigDecimal unit = i.getBasePrice();
            String variantName = null;
            if (l.variant() != null && !l.variant().isBlank()) {
                ItemVariant v = i.getVariants().stream().filter(x -> x.getName().equalsIgnoreCase(l.variant())).findFirst()
                        .orElseThrow(() -> new BadRequestException("VARIANT_UNKNOWN", "'" + i.getName() + "' has no variant " + l.variant()));
                unit = unit.add(v.getExtraPrice());
                variantName = v.getName();
            } else if (!i.getVariants().isEmpty()) {
                throw new BadRequestException("VARIANT_REQUIRED", "Please choose a size for '" + i.getName() + "'");
            }
            List<String> addOnNames = new ArrayList<>();
            if (l.addOnIds() != null) {
                for (Long aid : new LinkedHashSet<>(l.addOnIds())) {
                    AddOn a = i.getAddOns().stream().filter(x -> x.getId().equals(aid)).findFirst()
                            .orElseThrow(() -> new BadRequestException("ADDON_UNKNOWN", "Add-on " + aid + " does not belong to '" + i.getName() + "'"));
                    if (!a.isAvailable()) throw new BadRequestException("ADDON_UNAVAILABLE", "Add-on '" + a.getName() + "' is unavailable");
                    unit = unit.add(a.getPrice());
                    addOnNames.add(a.getName());
                }
            }
            BigDecimal total = unit.multiply(BigDecimal.valueOf(l.quantity()));
            subtotal = subtotal.add(total);
            prep = Math.max(prep, i.getPrepTimeMinutes());
            out.add(new Dtos.PricedLine(i.getId(), i.getName(), variantName, addOnNames, l.quantity(), unit, total, i.isVegetarian(), i.getPrepTimeMinutes()));
        }
        return new Dtos.ValidateResponse(req.restaurantId(), out, subtotal, prep);
    }

    @Transactional(readOnly = true)
    public Dtos.ItemInfo info(Long id) {
        MenuItem i = items.findById(id).orElseThrow(() -> new NotFoundException("Menu item", id));
        return new Dtos.ItemInfo(i.getId(), i.getRestaurantId(), i.getName(), i.getBasePrice(), i.isAvailable(), i.isActive());
    }

    @Transactional
    public void addPopularity(Long restaurantId, Long menuItemId, int quantity) {
        ItemPopularity p = popularity.findById(menuItemId).orElseGet(() -> {
            ItemPopularity n = new ItemPopularity();
            n.setMenuItemId(menuItemId);
            n.setRestaurantId(restaurantId);
            return n;
        });
        p.setOrderedQuantity(p.getOrderedQuantity() + quantity);
        popularity.save(p);
    }

    @CacheEvict(cacheNames = "menu-popular", allEntries = true)
    public void evictPopular() { /* called through the Spring proxy by the Kafka consumer */ }

    /**
     * Programmatic eviction for calls made from inside this class (annotation-driven eviction is skipped on
     * self-invocation). Runs AFTER the transaction commits so a concurrent reader cannot re-cache stale data.
     */
    private void evictMenu(Long restaurantId) {
        Runnable evict = () -> {
            var cache = cacheManager.getCache("menu");
            if (cache != null) cache.evict(restaurantId);
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { evict.run(); }
            });
        } else evict.run();
    }

    // ------------------------------------------------------------------ helpers
    private void apply(MenuItem i, MenuCategory c, Dtos.ItemRequest r) {
        i.setCategory(c);
        i.setName(r.name().trim());
        i.setDescription(r.description());
        i.setBasePrice(r.basePrice());
        i.setVegetarian(r.vegetarian());
        if (r.prepTimeMinutes() != null) i.setPrepTimeMinutes(r.prepTimeMinutes());
        i.setTags(r.tags());
        i.getVariants().clear();
        i.getAddOns().clear();
        Set<String> seen = new HashSet<>();
        if (r.variants() != null) for (var v : r.variants()) {
            if (!seen.add(v.name().toLowerCase())) throw new BadRequestException("Duplicate variant " + v.name());
            ItemVariant x = new ItemVariant();
            x.setItem(i);
            x.setName(v.name().trim());
            x.setExtraPrice(v.extraPrice());
            i.getVariants().add(x);
        }
        if (r.addOns() != null) for (var a : r.addOns()) {
            AddOn x = new AddOn();
            x.setItem(i);
            x.setName(a.name().trim());
            x.setPrice(a.price());
            x.setAvailable(a.available() == null || a.available());
            i.getAddOns().add(x);
        }
    }

    private MenuCategory category(Long id) { return categories.findById(id).filter(MenuCategory::isActive).orElseThrow(() -> new NotFoundException("Category", id)); }
    private MenuItem detailed(Long id) { return items.findDetailed(id).orElseThrow(() -> new NotFoundException("Menu item", id)); }
}
