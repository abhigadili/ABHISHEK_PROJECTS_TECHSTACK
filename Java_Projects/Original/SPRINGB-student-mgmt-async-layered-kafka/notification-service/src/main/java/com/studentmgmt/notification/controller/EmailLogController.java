package com.studentmgmt.notification.controller;

import com.studentmgmt.notification.model.EmailLog;
import com.studentmgmt.notification.service.EmailLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/email-logs")
public class EmailLogController {

    private final EmailLogService emailLogService;

    public EmailLogController(EmailLogService emailLogService) {
        this.emailLogService = emailLogService;
    }

    @GetMapping
    public List<EmailLog> findAll(@RequestParam(required = false) Long notificationId) {
        return emailLogService.findAll(notificationId);
    }

    @GetMapping("/{id}")
    public EmailLog findById(@PathVariable Long id) {
        return emailLogService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EmailLog create(@Valid @RequestBody EmailLog emailLog) {
        return emailLogService.create(emailLog);
    }
}
