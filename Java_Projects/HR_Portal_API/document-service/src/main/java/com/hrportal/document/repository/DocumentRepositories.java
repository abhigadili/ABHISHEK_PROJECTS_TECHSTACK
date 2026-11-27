package com.hrportal.document.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.document.entity.Document;
import com.hrportal.document.entity.DocumentCategory;
import com.hrportal.document.entity.DocumentHistory;
import com.hrportal.document.entity.DocumentPermission;
import com.hrportal.document.entity.Enums.DocumentStatus;

public final class DocumentRepositories {
    private DocumentRepositories() {
    }

    public interface CategoryRepository extends JpaRepository<DocumentCategory, String> {
        Optional<DocumentCategory> findByCodeIgnoreCase(String code);

        List<DocumentCategory> findByActiveTrueOrderByName();
    }

    public interface DocumentRepository extends JpaRepository<Document, String> {
        List<Document> findByOwnerEmployeeIdAndCurrentVersionTrueOrderByCreatedAtDesc(String ownerEmployeeId);

        List<Document> findByOwnerEmployeeIdAndTitleAndCategoryIdOrderByVersionNumberDesc(String ownerEmployeeId, String title, String categoryId);

        Optional<Document> findByStoragePath(String storagePath);

        List<Document> findByStatusAndCurrentVersionTrueOrderByCreatedAtAsc(DocumentStatus status);

        @Query("select d from Document d where d.currentVersion = true and d.expiryDate is not null and d.expiryDate <= :limit order by d.expiryDate")
        List<Document> findExpiringBy(@Param("limit") LocalDate limit);

        List<Document> findByIdIn(Collection<String> ids);
    }

    public interface PermissionRepository extends JpaRepository<DocumentPermission, String> {
        List<DocumentPermission> findByDocumentId(String documentId);
    }

    public interface HistoryRepository extends JpaRepository<DocumentHistory, String> {
        List<DocumentHistory> findByDocumentIdOrderByCreatedAtAsc(String documentId);
    }
}
