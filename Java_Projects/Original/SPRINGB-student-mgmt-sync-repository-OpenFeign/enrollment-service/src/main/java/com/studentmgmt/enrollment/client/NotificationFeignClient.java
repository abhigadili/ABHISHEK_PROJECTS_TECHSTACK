package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.NotificationSendRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Declarative synchronous HTTP contract for notification-service. */
@FeignClient(name = "notification-service", url = "${services.notification.base-url}")
public interface NotificationFeignClient {

    @PostMapping("/api/notifications/send")
    Object send(@RequestBody NotificationSendRequest request);
}
