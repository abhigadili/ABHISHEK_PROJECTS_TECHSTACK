package com.fooddelivery.search.engine;

import com.fooddelivery.search.web.Dtos;

/**
 * Search abstraction. The MySQL implementation is used today; swapping in Elasticsearch/OpenSearch later means writing a new
 * implementation of this interface (and an indexer) - controllers and services do not change.
 */
public interface SearchEngine {
    String name();
    Dtos.SearchResponse search(Dtos.SearchQuery query);
    java.util.List<String> suggest(String prefix, int limit);
}
