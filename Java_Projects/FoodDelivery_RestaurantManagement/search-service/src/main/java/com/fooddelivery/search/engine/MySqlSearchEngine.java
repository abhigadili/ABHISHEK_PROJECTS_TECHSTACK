package com.fooddelivery.search.engine;

import com.fooddelivery.search.domain.IndexedRestaurant;
import com.fooddelivery.search.repository.IndexedFoodRepository;
import com.fooddelivery.search.repository.IndexedRestaurantRepository;
import com.fooddelivery.search.web.Dtos;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/** MySQL implementation: LIKE-based matching with a relevance ORDER BY, optional city / distance / vegetarian filters. */
@Component
public class MySqlSearchEngine implements SearchEngine {
    private final IndexedRestaurantRepository restaurants;
    private final IndexedFoodRepository foods;

    public MySqlSearchEngine(IndexedRestaurantRepository restaurants, IndexedFoodRepository foods) {
        this.restaurants = restaurants;
        this.foods = foods;
    }

    @Override public String name() { return "mysql"; }

    @Override
    @Transactional(readOnly = true)
    public Dtos.SearchResponse search(Dtos.SearchQuery q) {
        String term = q.q() == null ? "" : q.q().trim().toLowerCase();
        String city = q.city() == null || q.city().isBlank() ? null : q.city().trim().toLowerCase();
        int limit = Math.min(Math.max(q.limit(), 1), 50);
        boolean all = q.type() == null || "all".equals(q.type());

        List<Dtos.RestaurantHit> rHits = new ArrayList<>();
        if (all || "restaurants".equals(q.type())) {
            List<IndexedRestaurant> found = term.isEmpty() ? restaurants.browse(city, PageRequest.of(0, 200)) : restaurants.search(term, city, PageRequest.of(0, 200));
            for (IndexedRestaurant r : found) {
                Double dist = null;
                if (q.lat() != null && q.lng() != null && r.getLatitude() != null) {
                    dist = Math.round(haversine(q.lat(), q.lng(), r.getLatitude(), r.getLongitude()) * 10.0) / 10.0;
                    if (q.radiusKm() != null && dist > q.radiusKm()) continue;
                }
                rHits.add(new Dtos.RestaurantHit(r.getRestaurantId(), r.getName(), r.getCity(), r.getCuisines(), r.getAddress(), r.getRating(), r.getRatingCount(), dist));
            }
            if (q.lat() != null && q.lng() != null) rHits.sort(Comparator.comparing(h -> h.distanceKm() == null ? 9999 : h.distanceKm()));
        }
        List<Dtos.FoodHit> fHits = new ArrayList<>();
        if ((all || "food".equals(q.type())) && !term.isEmpty()) {
            Map<Long, String> names = restaurants.findAllById(foods.search(term, city, q.vegetarian(), PageRequest.of(0, limit)).stream().map(f -> f.getRestaurantId()).distinct().toList())
                    .stream().collect(Collectors.toMap(IndexedRestaurant::getRestaurantId, IndexedRestaurant::getName));
            foods.search(term, city, q.vegetarian(), PageRequest.of(0, limit)).forEach(f -> fHits.add(new Dtos.FoodHit(f.getMenuItemId(), f.getName(), f.getDescription(),
                    f.getCategory(), f.getPrice(), f.isVegetarian(), f.getImageUrl(), f.getRestaurantId(), names.get(f.getRestaurantId()))));
        }
        List<String> cuisines = (all || "cuisines".equals(q.type())) ? cuisineMatches(term) : List.of();
        List<String> categories = (all || "categories".equals(q.type())) ? foods.categories().stream().filter(c -> term.isEmpty() || c.toLowerCase().contains(term)).toList() : List.of();
        return new Dtos.SearchResponse(term, name(), rHits.size() > limit ? rHits.subList(0, limit) : rHits, fHits, cuisines, categories, List.of());
    }

    List<String> cuisineMatches(String term) {
        return allCuisines().stream().filter(c -> term.isEmpty() || c.toLowerCase().contains(term)).toList();
    }

    public List<String> allCuisines() {
        return restaurants.cuisineLists().stream().flatMap(s -> Arrays.stream(s.split(","))).map(String::trim).filter(s -> !s.isEmpty())
                .collect(Collectors.toCollection(TreeSet::new)).stream().toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> suggest(String prefix, int limit) {
        String p = prefix == null ? "" : prefix.trim().toLowerCase();
        if (p.isEmpty()) return List.of();
        Set<String> out = new LinkedHashSet<>(restaurants.suggestNames(p, PageRequest.of(0, limit)));
        out.addAll(foods.suggestNames(p, PageRequest.of(0, limit)));
        return out.stream().limit(limit).toList();
    }

    private static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
