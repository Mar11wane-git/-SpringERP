package com.springerp.audit;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditRepository repository;
    private final Clock clock;

    public record AuditEventResponse(Long id, Instant occurredAt, Long actorId, String actorEmail,
            AuditAction action, String entityType, String entityId, String summary, String ipAddress,
            String correlationId) {

        static AuditEventResponse from(AuditEvent e) {
            return new AuditEventResponse(e.getId(), e.getOccurredAt(), e.getActorId(), e.getActorEmail(),
                    e.getAction(), e.getEntityType(), e.getEntityId(), e.getSummary(), e.getIpAddress(),
                    e.getCorrelationId());
        }
    }

    /** Records an action by the current user inside the caller's transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuditAction action, String entityType, Object entityId, String summary) {
        save(action, CurrentUser.id().orElse(null), CurrentUser.email().orElse(null), entityType, entityId, summary);
    }

    /**
     * Records an event in its own transaction so it survives a rollback of the
     * surrounding work (used for failed logins and detected token reuse).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordIndependently(AuditAction action, Long actorId, String actorEmail, String summary) {
        save(action, actorId, actorEmail, "User", actorId, summary);
    }

    private void save(AuditAction action, Long actorId, String actorEmail, String entityType, Object entityId,
            String summary) {
        AuditEvent event = new AuditEvent();
        event.setOccurredAt(clock.instant());
        event.setActorId(actorId);
        event.setActorEmail(actorEmail);
        event.setAction(action);
        event.setEntityType(entityType);
        event.setEntityId(entityId == null ? null : String.valueOf(entityId));
        event.setSummary(summary.length() > 500 ? summary.substring(0, 500) : summary);
        event.setIpAddress(clientIp());
        event.setCorrelationId(MDC.get("correlationId"));
        repository.save(event);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEventResponse> search(String search, AuditAction action, String entityType,
            LocalDate from, LocalDate to, Pageable pageable) {
        Pageable page = Pagination.sanitize(pageable, Set.of("occurredAt", "action"),
                Sort.by(Sort.Direction.DESC, "occurredAt"));
        Instant fromInstant = from == null ? null : from.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant toInstant = to == null ? null : to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        return PageResponse.of(repository.search(Pagination.likePattern(search), action, entityType, fromInstant,
                toInstant, page), AuditEventResponse::from);
    }

    @Transactional(readOnly = true)
    public List<AuditEventResponse> recent() {
        return repository.findTop10ByOrderByOccurredAtDesc().stream().map(AuditEventResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AuditEventResponse> forEntity(String entityType, Object entityId) {
        return repository.findByEntityTypeAndEntityIdOrderByOccurredAtDesc(entityType, String.valueOf(entityId))
                .stream().map(AuditEventResponse::from).toList();
    }

    private static String clientIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            HttpServletRequest request = attrs.getRequest();
            return request.getRemoteAddr();
        }
        return null;
    }
}
