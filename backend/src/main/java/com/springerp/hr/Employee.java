package com.springerp.hr;

import java.time.LocalDate;

import com.springerp.common.persistence.BaseEntity;
import com.springerp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "employees")
public class Employee extends BaseEntity {

    public enum Status { ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED }

    public enum EmploymentType { FULL_TIME, PART_TIME, CONTRACT, INTERN }

    @Column(nullable = false, length = 20, updatable = false)
    private String employeeNumber;

    @Column(nullable = false, length = 80)
    private String firstName;

    @Column(nullable = false, length = 80)
    private String lastName;

    @Column(nullable = false, length = 150)
    private String email;

    @Column(length = 40)
    private String phone;

    @Column(nullable = false, length = 100)
    private String jobTitle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    private Employee manager;

    /** Optional link to the login account of this employee (enables self-service leave). */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmploymentType employmentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ACTIVE;

    @Column(nullable = false)
    private LocalDate hireDate;

    private LocalDate contractEndDate;

    private LocalDate terminationDate;

    public String fullName() {
        return firstName + " " + lastName;
    }
}
