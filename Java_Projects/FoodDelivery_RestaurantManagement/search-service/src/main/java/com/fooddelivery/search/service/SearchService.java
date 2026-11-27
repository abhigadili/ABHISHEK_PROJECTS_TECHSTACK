package com.fooddelivery.search.service;

import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.search.domain.IndexedFood;
import com.fooddelivery.search.domain.IndexedRestaurant;
import com.fooddelivery.search.engine.MySqlSearchEngine;
import com.fooddelivery.search.engine.SearchEngine;
import com.fooddelivery.search.repository.IndexedFoodRepository;
import com.fooddelivery.search.repository.IndexedRestaurantRepository;
import com.fooddelivery.search.web.Dtos;
import com.fooddelivery.common.cache.CacheEvictor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/** Query side (cached 1 min) + index maintenance from events. */
@Service
public class SearchService {
    private final SearchEngine engine;
    private final MySqlSearchEngine mysql;
    private final OfferLookup offers;
    private final IndexedRestaurantRepository restaurants;
    private final IndexedFoodRepository foods;
    private final CacheEvictor evictor;

    public SearchService(SearchEngine engine, MySqlSearchEngine mysql, OfferLookup offers, IndexedRestaurantRepository restaurants, IndexedFoodRepository foods,
                         CacheEvictor evictor) {
        this.evictor = evictor;
        this.engine = engine;
        this.mysql = mysql;
        this.offers = offers;
        this.restaurants = restaurants;
        this.foods = foods;
    }

    @Cacheable(cacheNames = "search", key = "T(java.util.Objects).hash(#q.q(), #q.type(), #q.city(), #q.lat(), #q.lng(), #q.radiusKm(), #q.vegetarian(), #q.limit())")
    public Dtos.SearchResponse search(Dtos.SearchQuery q) {
        Dtos.SearchResponse base = engine.search(q);
        boolean wantOffers = q.type() == null || "all".equals(q.type()) || "offers".equals(q.type());
        return new Dtos.SearchResponse(base.query(), base.engine(), new ArrayList<>(base.restaurants()), new ArrayList<>(base.foods()), new ArrayList<>(base.cuisines()),
                new ArrayList<>(base.categories()), wantOffers ? new ArrayList<>(offers.offers(q.q())) : new ArrayList<>());
    }

    public List<String> suggest(String prefix) { return engine.suggest(prefix, 8); }

    @Cacheable(cacheNames = "search-reference", key = "'cuisines'")
    public ArrayList<String> cuisines() { return new ArrayList<>(mysql.allCuisines()); }

    @Cacheable(cacheNames = "search-reference", key = "'locations'")
    @Transactional(readOnly = true)
    public ArrayList<String> locations() { return new ArrayList<>(restaurants.cities()); }

    // ---------------------------------------------------- index maintenance (Kafka)
    @Transactional
    public void onRestaurantEvent(String eventType, Events.RestaurantApproved e) {
        IndexedRestaurant r = restaurants.findById(e.restaurantId()).orElseGet(IndexedRestaurant::new);
        r.setRestaurantId(e.restaurantId());
        r.setName(e.name());
        r.setCity(e.city());
        r.setCuisines(e.cuisines());
        r.setAddress(e.address());
        r.setLatitude(e.latitude());
        r.setLongitude(e.longitude());
        r.setAcceptingOrders(e.open());
        r.setActive("RestaurantApproved".equals(eventType));         // suspended / rejected / deactivated drop out of search
        restaurants.save(r);
        evictor.clear("search", "search-reference");
    }

    @Transactional
    public void onMenuItem(Events.MenuItemEvent e) {
        IndexedFood f = foods.findById(e.menuItemId()).orElseGet(IndexedFood::new);
        f.setMenuItemId(e.menuItemId());
        f.setRestaurantId(e.restaurantId());
        f.setName(e.name());
        f.setDescription(e.description());
        f.setCategory(e.category());
        f.setPrice(e.price());
        f.setVegetarian(e.vegetarian());
        f.setAvailable(e.available());
        f.setImageUrl(e.imageUrl());
        foods.save(f);
        evictor.clear("search");
    }

    @Transactional
    public void onRating(long restaurantId, double avg, long count) {
        restaurants.findById(restaurantId).ifPresent(r -> {
            r.setRating(BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP));
            r.setRatingCount(count);
        });
        evictor.clear("search");
    }
}
