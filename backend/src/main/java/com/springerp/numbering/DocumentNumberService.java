package com.springerp.numbering;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Allocates human-readable business numbers (INV-2026-00001, EMP-00042...).
 *
 * The sequence row is locked with SELECT ... FOR UPDATE inside the caller's
 * transaction, so numbers are unique and gap-free: if the business operation rolls
 * back, so does the increment. Concurrent callers for the same prefix serialize
 * on that row only.
 */
@Service
@RequiredArgsConstructor
public class DocumentNumberService {

    private final EntityManager em;

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextYearly(String prefix, int year) {
        return "%s-%d-%05d".formatted(prefix, year, allocate(prefix + "-" + year));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String next(String prefix) {
        return "%s-%05d".formatted(prefix, allocate(prefix));
    }

    private long allocate(String key) {
        // Idempotent creation; a concurrent insert of the same key is simply ignored.
        em.createNativeQuery("INSERT IGNORE INTO document_sequences (sequence_key, next_value) VALUES (?1, 1)")
                .setParameter(1, key)
                .executeUpdate();
        DocumentSequence sequence = em.find(DocumentSequence.class, key, LockModeType.PESSIMISTIC_WRITE);
        long value = sequence.getNextValue();
        sequence.setNextValue(value + 1);
        return value;
    }
}
