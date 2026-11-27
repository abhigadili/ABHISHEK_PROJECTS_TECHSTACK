package com.hrportal.document.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

import org.springframework.web.multipart.MultipartFile;

/** Secure upload: the declared content type must be allow-listed AND the first bytes must match it (a renamed .exe cannot pass as a PDF). */
public final class FileTypeSniffer {
    private FileTypeSniffer() {
    }

    public static Optional<String> detect(MultipartFile file) throws IOException {
        byte[] head = new byte[8];
        int n;
        try (InputStream in = file.getInputStream()) {
            n = in.readNBytes(head, 0, head.length);
        }
        if (n >= 4 && head[0] == '%' && head[1] == 'P' && head[2] == 'D' && head[3] == 'F') return Optional.of("application/pdf");
        if (n >= 8 && (head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') return Optional.of("image/png");
        if (n >= 3 && (head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) return Optional.of("image/jpeg");
        if (n >= 4 && head[0] == 'P' && head[1] == 'K' && head[2] == 3 && head[3] == 4) return Optional.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if (name.endsWith(".txt") && isText(head, n)) return Optional.of("text/plain");
        return Optional.empty();
    }

    private static boolean isText(byte[] b, int n) {
        for (int i = 0; i < n; i++) if (b[i] == 0) return false;
        return true;
    }
}
