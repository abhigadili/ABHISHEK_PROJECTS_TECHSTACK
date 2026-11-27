package com.hrportal.notification.service;


import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.persistence.CrudService;
import com.hrportal.notification.dto.NotificationDtos.EmailSettingRequest;
import com.hrportal.notification.dto.NotificationDtos.EmailSettingResponse;
import com.hrportal.notification.dto.NotificationDtos.TemplateRequest;
import com.hrportal.notification.dto.NotificationDtos.TemplateResponse;
import com.hrportal.notification.entity.EmailSetting;
import com.hrportal.notification.entity.Enums.EmailMode;
import com.hrportal.notification.entity.NotificationTemplate;
import com.hrportal.notification.repository.NotificationRepositories.EmailSettingRepository;
import com.hrportal.notification.repository.NotificationRepositories.TemplateRepository;

/** Notification templates (CRUD) and the configurable e-mail settings. */
public final class TemplateSettingsService {
    private TemplateSettingsService() {
    }

    @Service
    public static class TemplateService extends CrudService<NotificationTemplate, TemplateRequest, TemplateResponse> {
        private final TemplateRepository templates;

        public TemplateService(TemplateRepository templates, AuditService audit) {
            super(templates, audit, NotificationTemplate.class, TemplateResponse.class);
            this.templates = templates;
        }

        @Override
        protected void beforeCreate(NotificationTemplate t, TemplateRequest r) {
            if (templates.findByCode(r.code()).isPresent()) throw new ConflictException("Template code already exists: " + r.code());
        }
    }

    @Service
    public static class EmailSettingsService {
        private final EmailSettingRepository settings;
        private final EmailSender sender;
        private final AuditService audit;

        public EmailSettingsService(EmailSettingRepository settings, EmailSender sender, AuditService audit) {
            this.settings = settings;
            this.sender = sender;
            this.audit = audit;
        }

        @Transactional(readOnly = true)
        public EmailSettingResponse get() {
            return toResponse(settings.findAll().stream().findFirst().orElseGet(EmailSetting::new));
        }

        @Transactional
        public EmailSettingResponse update(EmailSettingRequest req) {
            EmailSetting s = settings.findAll().stream().findFirst().orElseGet(EmailSetting::new);
            if (req.mode() != null) s.setMode(EmailMode.valueOf(req.mode()));
            if (req.enabled() != null) s.setEnabled(req.enabled());
            if (req.host() != null) s.setHost(req.host());
            if (req.port() != null) s.setPort(req.port());
            if (req.username() != null) s.setUsername(req.username());
            if (req.startTls() != null) s.setStartTls(req.startTls());
            if (req.fromAddress() != null) s.setFromAddress(req.fromAddress());
            s = settings.save(s);
            audit.record("EmailSetting", s.getId(), "UPDATED", s.getMode() + " " + s.getHost());
            return toResponse(s);
        }

        private EmailSettingResponse toResponse(EmailSetting s) {
            return new EmailSettingResponse(s.getMode().name(), s.isEnabled(), s.getHost(), s.getPort(), s.getUsername(), s.isStartTls(), s.getFromAddress(), sender.passwordConfigured());
        }
    }
}
