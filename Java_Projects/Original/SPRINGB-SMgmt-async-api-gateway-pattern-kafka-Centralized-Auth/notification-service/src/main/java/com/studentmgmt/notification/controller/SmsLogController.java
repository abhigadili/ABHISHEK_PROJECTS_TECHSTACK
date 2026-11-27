package com.studentmgmt.notification.controller;

import com.studentmgmt.notification.entity.SmsLog;
import com.studentmgmt.notification.service.SmsLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sms-logs")
public class SmsLogController {

    private final SmsLogService smsLogService;

    public SmsLogController(SmsLogService smsLogService) {
        this.smsLogService = smsLogService;
    }

    @GetMapping
    public List<SmsLog> findAll(@RequestParam(required = false) Long notificationId) {
        return smsLogService.findAll(notificationId);
    }

    @GetMapping("/{id}")
    public SmsLog findById(@PathVariable Long id) {
        return smsLogService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SmsLog create(@Valid @RequestBody SmsLog log) {
        return smsLogService.create(log);
    }
}
