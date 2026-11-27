package com.fooddelivery.common.kafka;

import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.env.Environment;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.util.ReflectionUtils;

import java.lang.reflect.Method;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * BeanPostProcessor that inspects every bean for {@code @KafkaListener} methods and {@link EventProducer} classes.
 * That gives the real, code-derived Producer -> Topic -> Consumer map shown in the monitoring UI.
 */
public class TopologyRegistry implements BeanPostProcessor, EnvironmentAware {
    private final List<TopologyEntry> entries = new CopyOnWriteArrayList<>();
    private Environment env;

    @Override
    public void setEnvironment(Environment environment) { this.env = environment; }

    public List<TopologyEntry> entries() { return List.copyOf(entries); }

    public String consumerClassFor(String topic) {
        return entries.stream().filter(e -> "CONSUMER".equals(e.role()) && e.topic().equals(topic))
                .map(TopologyEntry::className).findFirst().orElse("unknown");
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        Class<?> target = AopUtils.getTargetClass(bean);
        String service = env.getProperty("spring.application.name", "unknown");
        EventProducer producer = AnnotationUtils.findAnnotation(target, EventProducer.class);
        if (producer != null) {
            for (String t : producer.topics()) {
                entries.add(new TopologyEntry(service, "PRODUCER", t, null, target.getSimpleName(), null));
            }
        }
        ReflectionUtils.doWithMethods(target, (Method m) -> {
            KafkaListener kl = AnnotationUtils.findAnnotation(m, KafkaListener.class);
            if (kl == null) return;
            String group = env.resolvePlaceholders(kl.groupId());
            for (String raw : kl.topics()) {
                if (raw.startsWith("#{")) continue;      // SpEL-driven wildcard listeners (the audit sink) are not part of the business map
                entries.add(new TopologyEntry(service, "CONSUMER", env.resolvePlaceholders(raw), group, target.getSimpleName(), m.getName()));
            }
        });
        return bean;
    }
}
