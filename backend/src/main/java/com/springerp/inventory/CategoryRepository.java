package com.springerp.inventory;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);

    List<Category> findAllByOrderByNameAsc();

    @Query("select p.category.id, count(p) from Product p where p.category is not null group by p.category.id")
    List<Object[]> countProductsByCategory();
}
