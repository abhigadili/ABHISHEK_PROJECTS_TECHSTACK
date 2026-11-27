package com.hrportal.common.persistence;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AES-256-GCM helper for column-level encryption of bank accounts and tax identifiers. The key is derived
 * (SHA-256) from HR_DATA_ENCRYPTION_KEY, which must come from the environment. JPA converters are created by
 * Hibernate, so the key is exposed through this static holder initialised at startup.
 */
@Component
public class CryptoKeyHolder {
    private static volatile SecretKeySpec key;
    private static final SecureRandom RANDOM = new SecureRandom();

    public CryptoKeyHolder(@Value("${hr.security.data-encryption-key:}") String secret) {
        if (secret == null || secret.length() < 16) {
            throw new IllegalStateException("HR_DATA_ENCRYPTION_KEY (hr.security.data-encryption-key) must be set (>= 16 chars)");
        }
        try {
            key = new SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8)), "AES");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static String encrypt(String plain) {
        if (plain == null) return null;
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] enc = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + enc.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(enc, 0, out, iv.length, enc.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    public static String decrypt(String cipherText) {
        if (cipherText == null) return null;
        try {
            byte[] all = Base64.getDecoder().decode(cipherText);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, 12));
            return new String(c.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Decryption failed", e);
        }
    }
}
