package com.fooddelivery.common.file;

import com.fooddelivery.common.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Local-disk implementation. Safety rules: size cap, content-type allow-list checked against the extension AND the
 * file's magic bytes, server-generated file names (never the client's), folder names restricted to [a-z0-9-].
 */
@Service
public class LocalFileStorageService implements FileStorageService {
    private static final Map<String, String> TYPES = Map.of("image/png", "png", "image/jpeg", "jpg", "image/webp", "webp");
    private static final Pattern SAFE = Pattern.compile("[a-z0-9-]{1,40}");
    private final Path root;
    private final long maxBytes;

    public LocalFileStorageService(@Value("${food.storage.root:./uploads}") String root,
                                   @Value("${food.storage.max-bytes:2097152}") long maxBytes) {
        this.root = Path.of(root).toAbsolutePath().normalize();
        this.maxBytes = maxBytes;
    }

    @Override
    public String store(MultipartFile file, String folder) {
        if (file == null || file.isEmpty()) throw new BadRequestException("FILE_EMPTY", "No file uploaded");
        if (!SAFE.matcher(folder).matches()) throw new BadRequestException("Invalid folder");
        if (file.getSize() > maxBytes) throw new BadRequestException("FILE_TOO_LARGE", "File exceeds " + maxBytes / 1024 + " KB");
        String ext = TYPES.get(file.getContentType());
        if (ext == null) throw new BadRequestException("FILE_TYPE", "Only PNG, JPEG or WEBP images are allowed");
        try {
            byte[] head = file.getInputStream().readNBytes(12);
            if (!magicMatches(head, ext)) throw new BadRequestException("FILE_TYPE", "File content does not match its declared type");
            Path dir = root.resolve(folder);
            Files.createDirectories(dir);
            String name = UUID.randomUUID() + "." + ext;
            try (var in = file.getInputStream()) { Files.copy(in, dir.resolve(name), StandardCopyOption.REPLACE_EXISTING); }
            return "/api/files/" + folder + "/" + name;
        } catch (IOException e) {
            throw new IllegalStateException("Could not store file", e);
        }
    }

    private boolean magicMatches(byte[] h, String ext) {
        if (h.length < 12) return false;
        return switch (ext) {
            case "png" -> (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G';
            case "jpg" -> (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8;
            case "webp" -> h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'E';
            default -> false;
        };
    }

    @Override
    public void delete(String url) {
        if (url == null || !url.startsWith("/api/files/")) return;
        String[] p = url.substring("/api/files/".length()).split("/");
        if (p.length != 2) return;
        try { Files.deleteIfExists(resolve(p[0], p[1])); } catch (IOException ignored) { }
    }

    @Override
    public Path resolve(String folder, String filename) {
        Path p = root.resolve(folder).resolve(filename).normalize();
        if (!p.startsWith(root)) throw new BadRequestException("Invalid path");
        return p;
    }
}
