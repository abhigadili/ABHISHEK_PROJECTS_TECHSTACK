package com.fooddelivery.admin.service;

import com.fooddelivery.admin.domain.ActivityEntry;
import com.fooddelivery.admin.domain.SystemConfig;
import com.fooddelivery.admin.repository.ActivityEntryRepository;
import com.fooddelivery.admin.repository.SystemConfigRepository;
import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.security.SecurityUtils;
import jakarta.annotation.PostConstruct;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class AdminService {
    private static final Map<String, String[]> DEFAULTS = Map.of(
            "platform.maintenance-banner", new String[]{"", "Banner shown to all users during maintenance (empty = none)"},
            "orders.cancellation-window-note", new String[]{"Orders can be cancelled until the restaurant starts preparing", "Policy text shown at checkout"},
            "delivery.offer-timeout-note", new String[]{"2 minutes", "Documented delivery offer timeout (configured in delivery-service)"},
            "support.contact-email", new String[]{"support@fooddelivery.example", "Support contact shown in the apps"});
    private final SystemConfigRepository configs;
    private final ActivityEntryRepository activity;

    public AdminService(SystemConfigRepository configs, ActivityEntryRepository activity) {
        this.configs = configs;
        this.activity = activity;
    }

    @PostConstruct
    @Transactional
    void seedDefaults() {
        DEFAULTS.forEach((k, v) -> {
            if (!configs.existsById(k)) {
                SystemConfig c = new SystemConfig();
                c.setKey(k);
                c.setValue(v[0]);
                c.setDescription(v[1]);
                c.setUpdatedBy("system");
                configs.save(c);
            }
        });
    }

    @Transactional(readOnly = true)
    public List<SystemConfig> allConfig() { return configs.findAll(); }

    @Audited("SYSTEM_CONFIG_UPDATE")
    @Transactional
    public SystemConfig setConfig(String key, String value) {
        SystemConfig c = configs.findById(key).orElseGet(() -> {
            SystemConfig n = new SystemConfig();
            n.setKey(key);
            return n;
        });
        c.setValue(value);
        c.setUpdatedBy(SecurityUtils.requireUser().username());
        c.setUpdatedAt(Instant.now());
        configs.save(c);
        activity.save(new ActivityEntry("ADMIN", "Config '" + key + "' changed", c.getUpdatedBy()));
        return c;
    }

    @Transactional
    public void record(String category, String message) { activity.save(new ActivityEntry(category, message, "system")); }

    @Transactional(readOnly = true)
    public Page<ActivityEntry> feed(int page, int size) { return activity.findAllByOrderByOccurredAtDesc(PageRequest.of(page, Math.min(size, 100))); }
}
