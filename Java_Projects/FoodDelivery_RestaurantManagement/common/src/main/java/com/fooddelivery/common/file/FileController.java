package com.fooddelivery.common.file;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

/** File download (public images). Any service can serve them because the dev storage directory is shared. */
@RestController
@RequestMapping("/api/files")
public class FileController {
    private final FileStorageService storage;

    public FileController(FileStorageService storage) { this.storage = storage; }

    @GetMapping("/{folder}/{filename:.+}")
    public ResponseEntity<Resource> get(@PathVariable String folder, @PathVariable String filename) throws java.io.IOException {
        Path p = storage.resolve(folder, filename);
        if (!Files.isRegularFile(p)) return ResponseEntity.notFound().build();
        String type = Files.probeContentType(p);
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .contentType(type == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(type))
                .body(new FileSystemResource(p));
    }
}
