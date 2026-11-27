package com.fooddelivery.notification.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "user-service")
public interface UserContactClient {
    record Contact(Long id, String fullName, String email, String phone) {}

    @GetMapping("/internal/users/{id}/contact")
    Contact contact(@PathVariable("id") Long id);
}
