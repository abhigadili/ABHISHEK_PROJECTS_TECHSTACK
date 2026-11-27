package com.fooddelivery.search.web;

import com.fooddelivery.search.service.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/search")
@Tag(name = "Search")
public class SearchController {
    private final SearchService service;

    public SearchController(SearchService service) { this.service = service; }

    @Operation(summary = "Search restaurants, food, cuisines, categories and offers (public)")
    @GetMapping
    public Dtos.SearchResponse search(@RequestParam(required = false) String q, @RequestParam(defaultValue = "all") String type, @RequestParam(required = false) String city,
                                      @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lng, @RequestParam(required = false) Double radiusKm,
                                      @RequestParam(required = false) Boolean vegetarian, @RequestParam(defaultValue = "20") int limit) {
        return service.search(new Dtos.SearchQuery(q, type, city, lat, lng, radiusKm, vegetarian, limit));
    }

    @GetMapping("/suggest")
    public List<String> suggest(@RequestParam String q) { return service.suggest(q); }

    @GetMapping("/cuisines")
    public List<String> cuisines() { return service.cuisines(); }

    @GetMapping("/locations")
    public List<String> locations() { return service.locations(); }
}
