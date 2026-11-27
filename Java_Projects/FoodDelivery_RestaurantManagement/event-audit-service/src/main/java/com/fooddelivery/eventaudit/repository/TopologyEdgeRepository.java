package com.fooddelivery.eventaudit.repository;

import com.fooddelivery.eventaudit.domain.TopologyEdge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TopologyEdgeRepository extends JpaRepository<TopologyEdge, Long> {
    Optional<TopologyEdge> findByServiceAndRoleAndTopicAndClassName(String service, String role, String topic, String className);
    List<TopologyEdge> findByTopic(String topic);
}
