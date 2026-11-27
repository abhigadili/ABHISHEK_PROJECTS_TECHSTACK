package com.fooddelivery.common.file;

import org.springframework.web.multipart.MultipartFile;

/** Storage abstraction: local disk today, an object store (S3/MinIO) later without touching callers. */
public interface FileStorageService {
    /** Validates (size/type) and stores the file; returns the public URL path, e.g. /api/files/menu/ab12.jpg. */
    String store(MultipartFile file, String folder);
    void delete(String url);
    java.nio.file.Path resolve(String folder, String filename);
}
