package com.fooddelivery.inventory.service;

import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.security.AuthUser;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.inventory.client.RestaurantGateway;
import com.fooddelivery.inventory.domain.Ingredient;
import com.fooddelivery.inventory.domain.Recipe;
import com.fooddelivery.inventory.domain.StockMovement;
import com.fooddelivery.inventory.event.InventoryEventProducer;
import com.fooddelivery.inventory.repository.IngredientRepository;
import com.fooddelivery.inventory.repository.RecipeRepository;
import com.fooddelivery.inventory.repository.StockMovementRepository;
import com.fooddelivery.inventory.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class InventoryService {
    private static final Logger log = LoggerFactory.getLogger(InventoryService.class);
    private final IngredientRepository ingredients;
    private final RecipeRepository recipes;
    private final StockMovementRepository movements;
    private final RestaurantGateway restaurants;
    private final InventoryEventProducer events;

    public InventoryService(IngredientRepository ingredients, RecipeRepository recipes, StockMovementRepository movements,
                            RestaurantGateway restaurants, InventoryEventProducer events) {
        this.ingredients = ingredients;
        this.recipes = recipes;
        this.movements = movements;
        this.restaurants = restaurants;
        this.events = events;
    }

    // ------------------------------------------------------------ ingredient management
    @Transactional
    public Dtos.IngredientDto create(Long restaurantId, Dtos.IngredientRequest r) {
        AuthUser u = SecurityUtils.requireUser();
        restaurants.requireOwnerOrAdmin(restaurantId, u);
        if (ingredients.existsByRestaurantIdAndNameIgnoreCase(restaurantId, r.name().trim())) throw new ConflictException("Ingredient already exists");
        Ingredient i = new Ingredient();
        i.setRestaurantId(restaurantId);
        i.setName(r.name().trim());
        i.setUnit(r.unit().trim());
        i.setQuantity(r.quantity());
        i.setLowStockThreshold(r.lowStockThreshold());
        ingredients.save(i);
        record(i, StockMovement.Type.RESTOCK, r.quantity(), "Initial stock", null, u.username());
        events.updated(i, "CREATED");
        return Dtos.IngredientDto.from(i);
    }

    @Transactional
    public Dtos.IngredientDto update(Long id, Dtos.IngredientRequest r) {
        Ingredient i = find(id);
        restaurants.requireOwnerOrAdmin(i.getRestaurantId(), SecurityUtils.requireUser());
        i.setName(r.name().trim());
        i.setUnit(r.unit().trim());
        i.setLowStockThreshold(r.lowStockThreshold());
        return Dtos.IngredientDto.from(i);
    }

    @Transactional(readOnly = true)
    public List<Dtos.IngredientDto> list(Long restaurantId) {
        restaurants.requireOwnerOrAdmin(restaurantId, SecurityUtils.requireUser());
        return ingredients.findByRestaurantIdOrderByName(restaurantId).stream().map(Dtos.IngredientDto::from).toList();
    }

    @Transactional
    public Dtos.IngredientDto restock(Long id, Dtos.RestockRequest r) {
        Ingredient i = find(id);
        AuthUser u = SecurityUtils.requireUser();
        restaurants.requireOwnerOrAdmin(i.getRestaurantId(), u);
        i.setQuantity(i.getQuantity().add(r.quantity()));          // @Version: concurrent edits -> 409 (optimistic lock)
        record(i, StockMovement.Type.RESTOCK, r.quantity(), r.reason() == null ? "Restock" : r.reason(), null, u.username());
        events.updated(i, "RESTOCK");
        return Dtos.IngredientDto.from(i);
    }

    @Transactional
    public Dtos.IngredientDto adjust(Long id, Dtos.AdjustRequest r) {
        Ingredient i = find(id);
        AuthUser u = SecurityUtils.requireUser();
        restaurants.requireOwnerOrAdmin(i.getRestaurantId(), u);
        BigDecimal delta = r.newQuantity().subtract(i.getQuantity());
        i.setQuantity(r.newQuantity());
        record(i, StockMovement.Type.ADJUSTMENT, delta, r.reason(), null, u.username());
        events.updated(i, "ADJUSTMENT");
        if (i.isLow()) events.lowStock(i, ownerOf(i.getRestaurantId()));
        return Dtos.IngredientDto.from(i);
    }

    @Transactional(readOnly = true)
    public Page<Dtos.MovementDto> history(Long ingredientId, int page, int size) {
        Ingredient i = find(ingredientId);
        restaurants.requireOwnerOrAdmin(i.getRestaurantId(), SecurityUtils.requireUser());
        return movements.findByIngredientIdOrderByCreatedAtDesc(ingredientId, PageRequest.of(page, Math.min(size, 100))).map(Dtos.MovementDto::from);
    }

    @Transactional(readOnly = true)
    public List<Dtos.IngredientDto> alerts(Long restaurantId) {
        restaurants.requireOwnerOrAdmin(restaurantId, SecurityUtils.requireUser());
        return ingredients.findLow(restaurantId).stream().map(Dtos.IngredientDto::from).toList();
    }

    @Transactional(readOnly = true)
    public Dtos.Overview overview() {
        var low = ingredients.findAllLow();
        return new Dtos.Overview(ingredients.count(), low.size(), low.stream().limit(50).map(Dtos.IngredientDto::from).toList());
    }

    // ------------------------------------------------------------ recipes
    @Transactional
    public Dtos.RecipeDto setRecipe(Long restaurantId, Long menuItemId, List<Dtos.RecipeLine> lines) {
        restaurants.requireOwnerOrAdmin(restaurantId, SecurityUtils.requireUser());
        recipes.deleteByMenuItemId(menuItemId);
        recipes.flush();
        for (var l : lines) {
            Ingredient ing = find(l.ingredientId());
            if (!ing.getRestaurantId().equals(restaurantId)) throw new ConflictException("Ingredient " + ing.getName() + " belongs to another restaurant");
            Recipe r = new Recipe();
            r.setRestaurantId(restaurantId);
            r.setMenuItemId(menuItemId);
            r.setIngredient(ing);
            r.setQuantityPerPortion(l.quantityPerPortion());
            recipes.save(r);
        }
        return recipeDto(menuItemId, recipes.findByMenuItemIdIn(List.of(menuItemId)));
    }

    @Transactional(readOnly = true)
    public List<Dtos.RecipeDto> recipesOf(Long restaurantId) {
        restaurants.requireOwnerOrAdmin(restaurantId, SecurityUtils.requireUser());
        return recipes.findByRestaurantId(restaurantId).stream().collect(Collectors.groupingBy(Recipe::getMenuItemId, LinkedHashMap::new, Collectors.toList()))
                .entrySet().stream().map(e -> recipeDto(e.getKey(), e.getValue())).toList();
    }

    private Dtos.RecipeDto recipeDto(Long menuItemId, List<Recipe> rs) {
        return new Dtos.RecipeDto(menuItemId, rs.stream().map(r -> new Dtos.RecipeLineDto(r.getIngredient().getId(), r.getIngredient().getName(),
                r.getIngredient().getUnit(), r.getQuantityPerPortion())).toList());
    }

    // ------------------------------------------------------------ availability / checks
    /** How many portions of each recipe-backed menu item can be cooked right now. */
    @Transactional(readOnly = true)
    public List<Dtos.Availability> availability(Long restaurantId) {
        Map<Long, List<Recipe>> byItem = recipes.findByRestaurantId(restaurantId).stream().collect(Collectors.groupingBy(Recipe::getMenuItemId));
        List<Dtos.Availability> out = new ArrayList<>();
        byItem.forEach((item, rs) -> out.add(new Dtos.Availability(item, rs.stream()
                .mapToLong(r -> r.getIngredient().getQuantity().divide(r.getQuantityPerPortion(), 0, RoundingMode.DOWN).longValue()).min().orElse(0))));
        return out;
    }

    /** Pre-order check (read only, no reservation). Reads committed data so it sees the latest consumption. */
    @Transactional(readOnly = true, isolation = Isolation.READ_COMMITTED)
    public Dtos.CheckResponse check(Dtos.CheckRequest req) {
        Map<Long, List<Recipe>> byItem = recipes.findByMenuItemIdIn(req.lines().stream().map(Dtos.CheckLine::menuItemId).toList())
                .stream().collect(Collectors.groupingBy(Recipe::getMenuItemId));
        Map<Long, BigDecimal> needed = new HashMap<>();
        Map<Long, Ingredient> byId = new HashMap<>();
        Map<Long, Long> ownerItem = new HashMap<>();
        for (var l : req.lines()) {
            for (Recipe r : byItem.getOrDefault(l.menuItemId(), List.of())) {
                needed.merge(r.getIngredient().getId(), r.getQuantityPerPortion().multiply(BigDecimal.valueOf(l.quantity())), BigDecimal::add);
                byId.put(r.getIngredient().getId(), r.getIngredient());
                ownerItem.putIfAbsent(r.getIngredient().getId(), l.menuItemId());
            }
        }
        List<Dtos.Shortage> shortages = new ArrayList<>();
        needed.forEach((ingId, need) -> {
            Ingredient ing = byId.get(ingId);
            if (ing.getQuantity().compareTo(need) < 0) shortages.add(new Dtos.Shortage(ownerItem.get(ingId), ing.getName(), need, ing.getQuantity()));
        });
        return new Dtos.CheckResponse(shortages.isEmpty(), shortages);
    }

    // ------------------------------------------------------------ Kafka-driven stock movement
    /**
     * Order confirmed: consume ingredients under a pessimistic row lock so two orders can never both take the last
     * portion. Shortage => nothing is deducted and a reservation-failed event triggers the order's compensation.
     */
    @Transactional
    public void consumeForOrder(Events.OrderConfirmed e) {
        if (!movements.findByOrderIdAndType(e.orderId(), StockMovement.Type.CONSUMPTION).isEmpty()) return;   // already done
        Map<Long, List<Recipe>> byItem = recipes.findByMenuItemIdIn(e.items().stream().map(Events.OrderLine::menuItemId).toList())
                .stream().collect(Collectors.groupingBy(Recipe::getMenuItemId));
        Map<Long, BigDecimal> needed = new TreeMap<>();
        for (var l : e.items()) {
            for (Recipe r : byItem.getOrDefault(l.menuItemId(), List.of())) {
                needed.merge(r.getIngredient().getId(), r.getQuantityPerPortion().multiply(BigDecimal.valueOf(l.quantity())), BigDecimal::add);
            }
        }
        if (needed.isEmpty()) return;      // nothing tracked for these items
        List<Ingredient> locked = ingredients.lockAllByIds(needed.keySet());
        for (Ingredient ing : locked) {
            if (ing.getQuantity().compareTo(needed.get(ing.getId())) < 0) {
                log.warn("Stock shortage for order {}: {} needs {} has {}", e.orderId(), ing.getName(), needed.get(ing.getId()), ing.getQuantity());
                events.reservationFailed(e.orderId(), e.restaurantId(), "Insufficient stock of " + ing.getName());
                return;
            }
        }
        long owner = 0;
        for (Ingredient ing : locked) {
            BigDecimal need = needed.get(ing.getId());
            ing.setQuantity(ing.getQuantity().subtract(need));
            record(ing, StockMovement.Type.CONSUMPTION, need.negate(), "Order " + e.orderNumber(), e.orderId(), "system");
            events.updated(ing, "CONSUMPTION");
            if (ing.isLow()) {
                if (owner == 0) owner = e.restaurantOwnerUserId();
                events.lowStock(ing, owner);
            }
        }
    }

    /** Order cancelled/rejected after stock was taken: put it back (idempotent: a RETURN is written once). */
    @Transactional
    public void returnForOrder(long orderId) {
        List<StockMovement> used = movements.findByOrderIdAndType(orderId, StockMovement.Type.CONSUMPTION);
        if (used.isEmpty() || !movements.findByOrderIdAndType(orderId, StockMovement.Type.RETURN).isEmpty()) return;
        List<Ingredient> locked = ingredients.lockAllByIds(used.stream().map(StockMovement::getIngredientId).collect(Collectors.toSet()));
        Map<Long, Ingredient> byId = locked.stream().collect(Collectors.toMap(Ingredient::getId, x -> x));
        for (StockMovement m : used) {
            Ingredient ing = byId.get(m.getIngredientId());
            BigDecimal back = m.getDelta().negate();
            ing.setQuantity(ing.getQuantity().add(back));
            record(ing, StockMovement.Type.RETURN, back, "Order " + orderId + " cancelled", orderId, "system");
            events.updated(ing, "RETURN");
        }
    }

    private long ownerOf(Long restaurantId) { return restaurants.info(restaurantId).ownerUserId(); }

    private void record(Ingredient i, StockMovement.Type type, BigDecimal delta, String reason, Long orderId, String actor) {
        StockMovement m = new StockMovement();
        m.setIngredientId(i.getId());
        m.setRestaurantId(i.getRestaurantId());
        m.setType(type);
        m.setDelta(delta);
        m.setBalanceAfter(i.getQuantity());
        m.setReason(reason);
        m.setOrderId(orderId);
        m.setActor(actor);
        movements.save(m);
    }

    private Ingredient find(Long id) { return ingredients.findById(id).orElseThrow(() -> new NotFoundException("Ingredient", id)); }
}
