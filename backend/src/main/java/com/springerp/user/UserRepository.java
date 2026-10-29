package com.springerp.user;

import java.util.List;
import java.util.Optional;

import com.springerp.security.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRoleAndActiveTrue(Role role);

    List<User> findByActiveTrueAndRoleIn(List<Role> roles);

    @Query("""
            select u from User u
            where (:pattern is null or lower(u.email) like :pattern or lower(u.fullName) like :pattern)
              and (:role is null or u.role = :role)
              and (:active is null or u.active = :active)
            """)
    Page<User> search(@Param("pattern") String pattern, @Param("role") Role role,
            @Param("active") Boolean active, Pageable pageable);
}
