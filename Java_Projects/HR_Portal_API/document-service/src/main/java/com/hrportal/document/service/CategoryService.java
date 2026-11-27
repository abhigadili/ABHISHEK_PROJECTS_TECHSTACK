package com.hrportal.document.service;

import org.springframework.stereotype.Service;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.persistence.CrudService;
import com.hrportal.document.dto.DocumentDtos.CategoryRequest;
import com.hrportal.document.dto.DocumentDtos.CategoryResponse;
import com.hrportal.document.entity.DocumentCategory;
import com.hrportal.document.repository.DocumentRepositories.CategoryRepository;

@Service
public class CategoryService extends CrudService<DocumentCategory, CategoryRequest, CategoryResponse> {
    private final CategoryRepository categories;

    public CategoryService(CategoryRepository categories, AuditService audit) {
        super(categories, audit, DocumentCategory.class, CategoryResponse.class);
        this.categories = categories;
    }

    @Override
    protected void beforeCreate(DocumentCategory c, CategoryRequest r) {
        if (categories.findByCodeIgnoreCase(r.code()).isPresent()) throw new ConflictException("Category code already exists: " + r.code());
    }
}
