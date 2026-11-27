package com.fooddelivery.delivery.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.kafka.Events;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.delivery.client.OrderInfoClient;
import com.fooddelivery.delivery.domain.*;
import com.fooddelivery.delivery.event.DeliveryEventProducer;
import com.fooddelivery.delivery.repository.*;
import com.fooddelivery.delivery.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Delivery workflow: READY_FOR_PICKUP order -> UNASSIGNED delivery -> offer to the least-recently-used available partner
 * (pessimistic lock on candidates) -> accept (or reject/expire and offer to the next) -> pickup -> complete.
 */
@Service
public class DeliveryService {
    private static final Logger log = LoggerFactory.getLogger(DeliveryService.class);
    private static final List<Delivery.Status> ACTIVE = List.of(Delivery.Status.ASSIGNED, Delivery.Status.ACCEPTED, Delivery.Status.PICKED_UP);
    private final DeliveryRepository deliveries;
    private final DeliveryPartnerRepository partners;
    private final AssignmentLogRepository logs;
    private final DeliveryEventProducer events;
    private final OrderInfoClient orderInfo;
    private final Duration offerTtl;

    public DeliveryService(DeliveryRepository deliveries, DeliveryPartnerRepository partners, AssignmentLogRepository logs, DeliveryEventProducer events,
                           OrderInfoClient orderInfo, @Value("${food.delivery.offer-ttl:2m}") Duration offerTtl) {
        this.deliveries = deliveries;
        this.partners = partners;
        this.logs = logs;
        this.events = events;
        this.orderInfo = orderInfo;
        this.offerTtl = offerTtl;
    }

    // ============================================================ Kafka-driven
    @Transactional
    public void onPartnerRegistered(Events.UserRegistered e) {
        DeliveryPartner p = partners.findById(e.userId()).orElseGet(DeliveryPartner::new);
        p.setUserId(e.userId());
        p.setFullName(e.fullName());
        p.setPhone(e.phone());
        partners.save(p);
    }

    /** Order is ready: create the delivery job (idempotent per order) and try to assign right away. */
    @Transactional
    public void onOrderReady(Events.OrderStatusUpdated e) {
        if (deliveries.findByOrderId(e.orderId()).isPresent()) return;
        var info = orderInfo.info(e.orderId());          // WebClient: authoritative addresses
        Delivery d = new Delivery();
        d.setOrderId(info.id());
        d.setOrderNumber(info.orderNumber());
        d.setCustomerId(info.customerId());
        d.setCustomerName(info.customerName());
        d.setRestaurantId(info.restaurantId());
        d.setPickupAddress(info.pickupAddress());
        d.setDeliveryAddress(info.deliveryAddress());
        d.setDeliveryCity(info.deliveryCity());
        deliveries.save(d);
        logs.save(new AssignmentLog(d.getId(), null, "CREATED", "Order ready for pickup"));
        tryAssign(d);
    }

    @Transactional
    public void onPartnerRating(Long partnerId, double avg, long count) {
        partners.findById(partnerId).ifPresent(p -> {
            p.setRatingAvg(BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP));
            p.setRatingCount(count);
        });
    }

    // ============================================================ assignment
    /** @return true if an offer was made. Candidates are locked FOR UPDATE so concurrent jobs cannot double-book a partner. */
    @Transactional
    public boolean tryAssign(Delivery d) {
        if (d.getStatus() != Delivery.Status.UNASSIGNED) return false;
        for (DeliveryPartner p : partners.lockAvailable()) {
            if (d.isExcluded(p.getUserId())) continue;
            p.setBusy(true);
            p.setLastAssignedAt(Instant.now());
            d.setPartnerUserId(p.getUserId());
            d.setStatus(Delivery.Status.ASSIGNED);
            d.setAssignedAt(Instant.now());
            d.setAssignmentExpiresAt(Instant.now().plus(offerTtl));
            d.setOfferCount(d.getOfferCount() + 1);
            logs.save(new AssignmentLog(d.getId(), p.getUserId(), "OFFERED", "Offer #" + d.getOfferCount()));
            events.assigned(d);
            log.info("Delivery {} for order {} offered to partner {}", d.getId(), d.getOrderNumber(), p.getUserId());
            return true;
        }
        log.warn("No available delivery partner for order {} (will retry)", d.getOrderNumber());
        return false;
    }

    /** Scheduler hook: retry unassigned jobs and expire stale offers. */
    @Transactional
    public void sweep() {
        for (Delivery d : deliveries.findTop50ByStatusAndAssignmentExpiresAtBefore(Delivery.Status.ASSIGNED, Instant.now())) {
            Long pid = d.getPartnerUserId();
            release(pid);
            d.exclude(pid);
            d.setPartnerUserId(null);
            d.setStatus(Delivery.Status.UNASSIGNED);
            logs.save(new AssignmentLog(d.getId(), pid, "EXPIRED", "Offer not answered in time"));
            log.warn("Offer for order {} expired for partner {}", d.getOrderNumber(), pid);
        }
        for (Delivery d : deliveries.findTop50ByStatusOrderByCreatedAtAsc(Delivery.Status.UNASSIGNED)) tryAssign(d);
    }

    // ============================================================ partner actions
    @Transactional
    public Dtos.DeliveryDto accept(Long id) {
        Delivery d = mine(id, Delivery.Status.ASSIGNED);
        if (d.getAssignmentExpiresAt() != null && d.getAssignmentExpiresAt().isBefore(Instant.now())) throw new BusinessException(HttpStatus.CONFLICT, "OFFER_EXPIRED", "This offer has expired");
        d.setStatus(Delivery.Status.ACCEPTED);
        d.setAcceptedAt(Instant.now());
        logs.save(new AssignmentLog(d.getId(), d.getPartnerUserId(), "ACCEPTED", null));
        events.accepted(d);
        return Dtos.DeliveryDto.from(d);
    }

    @Transactional
    public Dtos.DeliveryDto reject(Long id, String reason) {
        Delivery d = mine(id, Delivery.Status.ASSIGNED);
        Long pid = d.getPartnerUserId();
        DeliveryPartner p = partners.findById(pid).orElseThrow();
        p.setRejectedOffers(p.getRejectedOffers() + 1);
        release(pid);
        d.exclude(pid);
        d.setPartnerUserId(null);
        d.setStatus(Delivery.Status.UNASSIGNED);
        logs.save(new AssignmentLog(d.getId(), pid, "REJECTED", reason));
        tryAssign(d);                               // immediately try the next partner
        return Dtos.DeliveryDto.from(d);
    }

    @Transactional
    public Dtos.DeliveryDto pickup(Long id) {
        Delivery d = mine(id, Delivery.Status.ACCEPTED);
        d.setStatus(Delivery.Status.PICKED_UP);
        d.setPickedUpAt(Instant.now());
        logs.save(new AssignmentLog(d.getId(), d.getPartnerUserId(), "PICKED_UP", null));
        events.pickedUp(d);
        return Dtos.DeliveryDto.from(d);
    }

    @Audited("DELIVERY_COMPLETE")
    @Transactional
    public Dtos.DeliveryDto complete(Long id) {
        Delivery d = mine(id, Delivery.Status.PICKED_UP);
        d.setStatus(Delivery.Status.DELIVERED);
        d.setDeliveredAt(Instant.now());
        DeliveryPartner p = partners.findById(d.getPartnerUserId()).orElseThrow();
        p.setCompletedDeliveries(p.getCompletedDeliveries() + 1);
        p.setBusy(false);
        logs.save(new AssignmentLog(d.getId(), d.getPartnerUserId(), "DELIVERED", null));
        events.completed(d);
        return Dtos.DeliveryDto.from(d);
    }

    @Transactional
    public Dtos.PartnerDto setOnline(boolean online) {
        DeliveryPartner p = me();
        if (p.isSuspended()) throw new ForbiddenException("Your delivery account is suspended");
        if (!online && p.isBusy()) throw new ConflictException("Finish your active delivery before going offline");
        p.setOnline(online);
        return Dtos.PartnerDto.from(p);
    }

    @Transactional
    public Dtos.PartnerDto updateProfile(Dtos.ProfileRequest r) {
        DeliveryPartner p = me();
        p.setFullName(r.fullName());
        p.setPhone(r.phone());
        p.setVehicleType(r.vehicleType());
        p.setVehicleNumber(r.vehicleNumber());
        return Dtos.PartnerDto.from(p);
    }

    @Transactional
    public Dtos.PartnerDto updateLocation(Dtos.LocationRequest r) {
        DeliveryPartner p = me();
        p.setLastLatitude(r.latitude());
        p.setLastLongitude(r.longitude());
        return Dtos.PartnerDto.from(p);
    }

    /** Profile of the caller; auto-provisioned if the user.registered event has not arrived yet. */
    @Transactional
    public DeliveryPartner me() {
        var u = SecurityUtils.requireUser();
        return partners.findById(u.userId()).orElseGet(() -> {
            DeliveryPartner p = new DeliveryPartner();
            p.setUserId(u.userId());
            p.setFullName(u.username());
            return partners.save(p);
        });
    }

    @Transactional(readOnly = true)
    public List<Dtos.DeliveryDto> current() {
        return deliveries.findByPartnerUserIdAndStatusIn(SecurityUtils.requireUser().userId(), ACTIVE).stream().map(Dtos.DeliveryDto::from).toList();
    }

    @Transactional(readOnly = true)
    public Page<Dtos.DeliveryDto> history(int page, int size) {
        return deliveries.findByPartnerUserIdAndStatusOrderByDeliveredAtDesc(SecurityUtils.requireUser().userId(), Delivery.Status.DELIVERED,
                PageRequest.of(page, Math.min(size, 100))).map(Dtos.DeliveryDto::from);
    }

    @Transactional
    public Dtos.Performance performance() {
        DeliveryPartner p = me();
        Double avg = deliveries.averageDeliveryMinutes(p.getUserId());
        return new Dtos.Performance(p.getCompletedDeliveries(), p.getRejectedOffers(), p.getRatingAvg(), p.getRatingCount(),
                avg == null ? null : Math.round(avg * 10.0) / 10.0, p.isOnline());
    }

    // ============================================================ admin
    @Transactional(readOnly = true)
    public Page<Dtos.DeliveryDto> list(Delivery.Status status, int page, int size) {
        var pr = PageRequest.of(page, Math.min(size, 100));
        return (status == null ? deliveries.findAllByOrderByCreatedAtDesc(pr) : deliveries.findByStatusOrderByCreatedAtDesc(status, pr)).map(Dtos.DeliveryDto::from);
    }

    @Transactional(readOnly = true)
    public List<Dtos.PartnerDto> allPartners() { return partners.findAll().stream().map(Dtos.PartnerDto::from).toList(); }

    @Transactional(readOnly = true)
    public List<Dtos.LogDto> trail(Long deliveryId) { return logs.findByDeliveryIdOrderByIdAsc(deliveryId).stream().map(Dtos.LogDto::from).toList(); }

    @Transactional(readOnly = true)
    public Dtos.DeliveryDto forOrder(Long orderId) {
        return deliveries.findByOrderId(orderId).map(Dtos.DeliveryDto::from).orElseThrow(() -> new NotFoundException("Delivery for order", orderId));
    }

    @Audited("DELIVERY_PARTNER_SUSPEND")
    @Transactional
    public Dtos.PartnerDto setSuspended(Long userId, boolean suspended) {
        DeliveryPartner p = partners.findById(userId).orElseThrow(() -> new NotFoundException("Delivery partner", userId));
        p.setSuspended(suspended);
        if (suspended) p.setOnline(false);
        return Dtos.PartnerDto.from(p);
    }

    @Transactional(readOnly = true)
    public Dtos.Overview overview() {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Delivery.Status s : Delivery.Status.values()) m.put(s.name(), 0L);
        for (Object[] r : deliveries.countsByStatus()) m.put(((Delivery.Status) r[0]).name(), (Long) r[1]);
        return new Dtos.Overview(partners.count(), partners.countByOnlineTrue(), partners.countByBusyTrue(), m);
    }

    // ============================================================ helpers
    private Delivery mine(Long id, Delivery.Status expected) {
        Delivery d = deliveries.findById(id).orElseThrow(() -> new NotFoundException("Delivery", id));
        if (!Objects.equals(d.getPartnerUserId(), SecurityUtils.requireUser().userId())) throw new ForbiddenException("This delivery is not assigned to you");
        if (d.getStatus() != expected) throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Delivery is " + d.getStatus() + ", expected " + expected);
        return d;
    }

    private void release(Long partnerId) { if (partnerId != null) partners.findById(partnerId).ifPresent(p -> p.setBusy(false)); }
}
