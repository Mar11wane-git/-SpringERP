package com.springerp.notification;

import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import com.springerp.common.api.PageResponse;
import com.springerp.common.error.NotFoundException;
import com.springerp.security.CurrentUser;
import com.springerp.security.Permission;
import com.springerp.security.Role;
import com.springerp.user.User;
import com.springerp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repository;
    private final UserRepository users;
    private final Clock clock;

    public record NotificationResponse(Long id, Notification.Type type, String title, String message, String link,
            Instant createdAt, boolean read) {

        static NotificationResponse from(Notification n) {
            return new NotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getMessage(), n.getLink(),
                    n.getCreatedAt(), n.getReadAt() != null);
        }
    }

    /** Notifies every active user whose role grants the permission (excluding the actor). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void notifyPermission(Permission permission, Notification.Type type, String title, String message,
            String link) {
        List<Role> roles = Arrays.stream(Role.values()).filter(r -> r.has(permission)).toList();
        Long actorId = CurrentUser.id().orElse(null);
        users.findByActiveTrueAndRoleIn(roles).stream()
                .map(User::getId)
                .filter(id -> !id.equals(actorId))
                .forEach(id -> notifyUser(id, type, title, message, link));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void notifyUser(Long recipientId, Notification.Type type, String title, String message, String link) {
        Notification n = new Notification();
        n.setRecipientId(recipientId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setLink(link);
        n.setCreatedAt(clock.instant());
        repository.save(n);
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> mine(boolean unreadOnly, int page, int size) {
        Long me = CurrentUser.requireId();
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(unreadOnly
                ? repository.findByRecipientIdAndReadAtIsNull(me, request)
                : repository.findByRecipientId(me, request), NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return repository.countByRecipientIdAndReadAtIsNull(CurrentUser.requireId());
    }

    @Transactional
    public NotificationResponse markRead(Long id) {
        Notification n = repository.findByIdAndRecipientId(id, CurrentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Notification", id));
        if (n.getReadAt() == null) {
            n.setReadAt(clock.instant());
        }
        return NotificationResponse.from(n);
    }

    @Transactional
    public int markAllRead() {
        return repository.markAllRead(CurrentUser.requireId(), clock.instant());
    }
}
