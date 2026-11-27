package com.fooddelivery.restaurant.service;

import com.fooddelivery.restaurant.exception.ResourceNotFoundException;
import com.fooddelivery.restaurant.model.Category;
import com.fooddelivery.restaurant.repository.CategoryRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public Flux<Category> findAll() {
        return categoryRepository.findAll();
    }

    public Mono<Category> findById(Long id) {
        return categoryRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Category not found: " + id)));
    }

    public Mono<Category> create(Category category) {
        return categoryRepository.save(new Category(null, category.categoryName(), category.categoryType(), category.description()));
    }

    public Mono<Category> update(Long id, Category category) {
        return findById(id)
                .map(existing -> new Category(id, category.categoryName(), category.categoryType(), category.description()))
                .flatMap(categoryRepository::save);
    }

    public Mono<Void> delete(Long id) {
        return findById(id).flatMap(categoryRepository::delete);
    }
}
