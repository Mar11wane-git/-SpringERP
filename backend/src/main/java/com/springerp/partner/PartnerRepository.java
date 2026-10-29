package com.springerp.partner;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.query.Param;

@NoRepositoryBean
public interface PartnerRepository<E extends Partner> extends JpaRepository<E, Long> {

    @Query("""
            select p from #{#entityName} p
            where (:pattern is null or lower(p.name) like :pattern or lower(p.code) like :pattern
                   or lower(p.email) like :pattern or lower(p.city) like :pattern or lower(p.contactName) like :pattern)
              and (:active is null or p.active = :active)
            """)
    Page<E> search(@Param("pattern") String pattern, @Param("active") Boolean active, Pageable pageable);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    boolean existsByTaxIdIgnoreCaseAndIdNot(String taxId, Long id);

    /** Same name in the same city: likely a duplicate record. */
    @Query("""
            select p from #{#entityName} p
            where lower(p.name) = lower(:name) and (:city is null or lower(p.city) = lower(:city)) and p.id <> :id
            """)
    List<E> findPossibleDuplicates(@Param("name") String name, @Param("city") String city, @Param("id") Long id);

    long countByActiveTrue();
}
