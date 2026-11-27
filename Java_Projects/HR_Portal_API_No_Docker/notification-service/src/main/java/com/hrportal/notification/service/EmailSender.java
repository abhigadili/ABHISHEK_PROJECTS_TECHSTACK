package com.hrportal.notification.service;

import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

import com.hrportal.common.util.LogMasker;
import com.hrportal.notification.entity.EmailSetting;
import com.hrportal.notification.entity.Enums.EmailMode;
import com.hrportal.notification.repository.NotificationRepositories.EmailSettingRepository;

/**
 * Sends one e-mail according to the configurable e-mail settings: SMTP (host / port / user from the database, password from the SMTP_PASSWORD
 * environment variable) or LOG mode, where the message is only written to the log (recipient masked, body never logged).
 */
@Component
public class EmailSender {
    private static final Logger log = LoggerFactory.getLogger(EmailSender.class);
    private final EmailSettingRepository settings;
    private final String smtpPassword;

    public EmailSender(EmailSettingRepository settings, @Value("${hr.notification.smtp-password:}") String smtpPassword) {
        this.settings = settings;
        this.smtpPassword = smtpPassword;
    }

    public boolean passwordConfigured() {
        return smtpPassword != null && !smtpPassword.isBlank();
    }

    /** @throws RuntimeException when delivery fails (the caller marks the notification FAILED) */
    public void send(String to, String subject, String body) {
        EmailSetting s = settings.findAll().stream().findFirst().orElse(null);
        if (s == null || !s.isEnabled()) throw new IllegalStateException("E-mail delivery is disabled");
        if (s.getMode() == EmailMode.LOG) {
            log.info("[e-mail LOG mode] to={} subject='{}' ({} chars)", LogMasker.maskEmail(to), subject, body.length());
            return;
        }
        if (s.getHost() == null || s.getPort() == null) throw new IllegalStateException("SMTP host / port are not configured");
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(s.getHost());
        sender.setPort(s.getPort());
        if (s.getUsername() != null && !s.getUsername().isBlank()) {
            sender.setUsername(s.getUsername());
            sender.setPassword(smtpPassword);
        }
        Properties p = sender.getJavaMailProperties();
        p.put("mail.smtp.auth", String.valueOf(s.getUsername() != null && !s.getUsername().isBlank()));
        p.put("mail.smtp.starttls.enable", String.valueOf(s.isStartTls()));
        p.put("mail.smtp.connectiontimeout", "5000");
        p.put("mail.smtp.timeout", "10000");
        SimpleMailMessage m = new SimpleMailMessage();
        m.setFrom(s.getFromAddress());
        m.setTo(to);
        m.setSubject(subject);
        m.setText(body);
        sender.send(m);
        log.info("[e-mail SMTP] sent to={} subject='{}'", LogMasker.maskEmail(to), subject);
    }
}
