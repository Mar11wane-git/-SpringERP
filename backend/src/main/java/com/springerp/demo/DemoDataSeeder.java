package com.springerp.demo;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import com.springerp.company.CompanyService;
import com.springerp.config.AppProperties;
import com.springerp.hr.DepartmentService;
import com.springerp.hr.Employee;
import com.springerp.hr.EmployeeService;
import com.springerp.hr.HrDtos.DepartmentRequest;
import com.springerp.hr.HrDtos.DepartmentResponse;
import com.springerp.hr.HrDtos.EmployeeRequest;
import com.springerp.hr.HrDtos.EmployeeResponse;
import com.springerp.hr.HrDtos.LeaveCreateRequest;
import com.springerp.hr.LeaveRequest;
import com.springerp.hr.LeaveService;
import com.springerp.inventory.InventoryDtos.CategoryRequest;
import com.springerp.inventory.InventoryDtos.CategoryResponse;
import com.springerp.inventory.InventoryDtos.ProductRequest;
import com.springerp.inventory.InventoryDtos.ProductResponse;
import com.springerp.inventory.InventoryDtos.StockMovementRequest;
import com.springerp.inventory.ProductService;
import com.springerp.inventory.StockMovement;
import com.springerp.inventory.StockService;
import com.springerp.invoicing.InvoiceDtos.CreateInvoiceRequest;
import com.springerp.invoicing.InvoiceDtos.InvoiceResponse;
import com.springerp.invoicing.InvoiceDtos.PaymentRequest;
import com.springerp.invoicing.InvoiceService;
import com.springerp.invoicing.Payment;
import com.springerp.partner.CustomerRepository;
import com.springerp.partner.CustomerService;
import com.springerp.partner.PartnerDtos.PartnerRequest;
import com.springerp.partner.PartnerDtos.PartnerResponse;
import com.springerp.partner.SupplierService;
import com.springerp.sales.SalesDtos.OrderLineRequest;
import com.springerp.sales.SalesDtos.OrderRequest;
import com.springerp.sales.SalesDtos.OrderResponse;
import com.springerp.sales.SalesOrderService;
import com.springerp.security.Role;
import com.springerp.security.SecurityConfig;
import com.springerp.user.User;
import com.springerp.user.UserDtos.CreateUserRequest;
import com.springerp.user.UserRepository;
import com.springerp.user.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Optional, clearly fictional dataset for local demos (APP_DEMO_DATA=true). It runs
 * through the real services, so stock levels, numbering, totals and the audit log
 * stay consistent. It runs once: it does nothing if any customer already exists.
 * Never enable it in production (the prod profile forces it off).
 */
@Component
@Order(2)
@ConditionalOnProperty(prefix = "app.demo-data", name = "enabled", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final AppProperties properties;
    private final UserRepository users;
    private final UserService userService;
    private final CustomerRepository customerRepository;
    private final CompanyService company;
    private final DepartmentService departments;
    private final EmployeeService employees;
    private final LeaveService leaves;
    private final ProductService products;
    private final StockService stock;
    private final CustomerService customers;
    private final SupplierService suppliers;
    private final SalesOrderService orders;
    private final InvoiceService invoices;
    private final Random random = new Random(42);

    public DemoDataSeeder(AppProperties properties, UserRepository users, UserService userService,
            CustomerRepository customerRepository, CompanyService company, DepartmentService departments,
            EmployeeService employees, LeaveService leaves, ProductService products, StockService stock,
            CustomerService customers, SupplierService suppliers, SalesOrderService orders, InvoiceService invoices) {
        this.properties = properties;
        this.users = users;
        this.userService = userService;
        this.customerRepository = customerRepository;
        this.company = company;
        this.departments = departments;
        this.employees = employees;
        this.leaves = leaves;
        this.products = products;
        this.stock = stock;
        this.customers = customers;
        this.suppliers = suppliers;
        this.orders = orders;
        this.invoices = invoices;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (customerRepository.count() > 0) {
            return;
        }
        User admin = users.findAll().stream().filter(u -> u.getRole() == Role.ADMIN).findFirst().orElse(null);
        if (admin == null) {
            log.warn("Demo data skipped: create the bootstrap administrator first.");
            return;
        }
        runAs(admin);
        try {
            seed();
            log.info("Demo dataset created (fictional data).");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /** Services audit "who did it"; the seeding is attributed to the administrator. */
    private static void runAs(User admin) {
        Jwt jwt = Jwt.withTokenValue("demo-seeder").header("alg", "none")
                .subject(String.valueOf(admin.getId()))
                .claim("email", admin.getEmail())
                .claim("role", Role.ADMIN.name())
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600))
                .build();
        SecurityContextHolder.getContext().setAuthentication(SecurityConfig.jwtAuthenticationConverter().convert(jwt));
    }

    private void seed() {
        LocalDate today = company.today();

        List<DepartmentResponse> depts = new ArrayList<>();
        String[][] deptData = {{"SAL", "Sales"}, {"OPS", "Operations"}, {"FIN", "Finance"},
                {"HR", "Human Resources"}, {"ENG", "Engineering"}};
        for (String[] d : deptData) {
            depts.add(departments.create(new DepartmentRequest(d[0], d[1], null, null, null, true, null)));
        }

        String[][] people = {
                {"Nora", "Bennett", "Sales Manager", "0"}, {"Liam", "Carter", "Account Executive", "0"},
                {"Maya", "Diaz", "Account Executive", "0"}, {"Owen", "Fischer", "Warehouse Lead", "1"},
                {"Ava", "Garcia", "Logistics Coordinator", "1"}, {"Ethan", "Hughes", "Accountant", "2"},
                {"Zoe", "Ivanova", "Financial Controller", "2"}, {"Lucas", "Jensen", "HR Specialist", "3"},
                {"Chloe", "Kim", "HR Manager", "3"}, {"Noah", "Laurent", "Software Engineer", "4"},
                {"Emma", "Moreau", "Software Engineer", "4"}, {"Leo", "Novak", "Engineering Manager", "4"}};
        List<EmployeeResponse> staff = new ArrayList<>();
        for (int i = 0; i < people.length; i++) {
            String[] p = people[i];
            staff.add(employees.create(new EmployeeRequest(p[0], p[1],
                    (p[0] + "." + p[1]).toLowerCase() + "@example.com", null, p[2],
                    depts.get(Integer.parseInt(p[3])).id(), null, null,
                    i == 10 ? Employee.EmploymentType.CONTRACT : Employee.EmploymentType.FULL_TIME,
                    today.minusMonths(6 + random.nextInt(48)), i == 10 ? today.plusMonths(8) : null, null)));
        }
        createDemoUsers(staff);

        CategoryResponse office = products.saveCategory(null, new CategoryRequest("Office Supplies", null, null));
        CategoryResponse electronics = products.saveCategory(null, new CategoryRequest("Electronics", null, null));
        CategoryResponse furniture = products.saveCategory(null, new CategoryRequest("Furniture", null, null));
        CategoryResponse packaging = products.saveCategory(null, new CategoryRequest("Packaging", null, null));

        PartnerResponse s1 = suppliers.create(partner("Northwind Components", "Lyon", "France"));
        PartnerResponse s2 = suppliers.create(partner("Bluebay Office Wholesale", "Porto", "Portugal"));
        PartnerResponse s3 = suppliers.create(partner("Atlas Furniture Works", "Valencia", "Spain"));

        Object[][] catalog = {
                {"OFF-PAPER-A4", "A4 copy paper (500 sheets)", office, s2, "ream", "6.90", "3.80", 400, 80},
                {"OFF-PEN-BLU", "Ballpoint pens, blue (box of 50)", office, s2, "box", "14.50", "7.20", 120, 30},
                {"OFF-NOTE-A5", "A5 notebooks (pack of 10)", office, s2, "pack", "22.00", "11.50", 90, 25},
                {"OFF-STAPLER", "Heavy-duty stapler", office, s2, "pcs", "18.90", "9.40", 18, 20},
                {"ELE-MON-27", "27\" IPS monitor", electronics, s1, "pcs", "249.00", "171.00", 35, 10},
                {"ELE-KBD-WL", "Wireless keyboard", electronics, s1, "pcs", "49.00", "26.00", 60, 15},
                {"ELE-MOUSE", "Ergonomic mouse", electronics, s1, "pcs", "39.00", "18.50", 75, 20},
                {"ELE-DOCK-USBC", "USB-C docking station", electronics, s1, "pcs", "159.00", "98.00", 8, 10},
                {"ELE-HEADSET", "Noise-cancelling headset", electronics, s1, "pcs", "129.00", "74.00", 25, 8},
                {"FUR-CHAIR-ERG", "Ergonomic office chair", furniture, s3, "pcs", "329.00", "205.00", 22, 6},
                {"FUR-DESK-160", "Height-adjustable desk 160cm", furniture, s3, "pcs", "549.00", "362.00", 12, 4},
                {"FUR-CAB-3D", "3-drawer cabinet", furniture, s3, "pcs", "189.00", "118.00", 4, 5},
                {"PKG-BOX-M", "Shipping box, medium (bundle of 25)", packaging, s2, "bundle", "27.50", "14.00", 140, 40},
                {"PKG-TAPE", "Packing tape (6 rolls)", packaging, s2, "pack", "12.90", "5.60", 200, 50}};
        List<ProductResponse> items = new ArrayList<>();
        for (Object[] c : catalog) {
            ProductResponse p = products.create(new ProductRequest((String) c[0], (String) c[1], null,
                    ((CategoryResponse) c[2]).id(), ((PartnerResponse) c[3]).id(), (String) c[4],
                    new BigDecimal((String) c[5]), new BigDecimal((String) c[6]), new BigDecimal("20.00"),
                    (Integer) c[8], null, true, null));
            stock.record(p.id(), new StockMovementRequest(StockMovement.Type.RECEIPT, (Integer) c[7],
                    new BigDecimal((String) c[6]), ((PartnerResponse) c[3]).id(), "PO-DEMO", "Initial purchase"));
            items.add(products.get(p.id()));
        }

        String[][] clients = {{"Helix Consulting", "Paris"}, {"Brightline Studios", "Lisbon"},
                {"Cobalt Logistics", "Hamburg"}, {"Meridian Health Clinic", "Madrid"}, {"Orchard Legal", "Brussels"},
                {"Pinecrest School", "Geneva"}, {"Quantum Retail", "Milan"}, {"Silverleaf Hotels", "Nice"}};
        List<PartnerResponse> buyers = new ArrayList<>();
        for (String[] c : clients) {
            buyers.add(customers.create(partner(c[0], c[1], null)));
        }

        // Orders spread over the last six months; older ones are invoiced and mostly paid.
        for (int i = 0; i < 28; i++) {
            LocalDate date = today.minusDays(175 - i * 6L);
            if (date.isAfter(today)) {
                date = today;
            }
            List<OrderLineRequest> lines = new ArrayList<>();
            int lineCount = 1 + random.nextInt(3);
            for (int l = 0; l < lineCount; l++) {
                ProductResponse p = items.get(random.nextInt(items.size()));
                if (lines.stream().anyMatch(x -> x.productId().equals(p.id()))) {
                    continue;
                }
                lines.add(new OrderLineRequest(p.id(), 1 + random.nextInt(4), null,
                        random.nextInt(4) == 0 ? new BigDecimal("5.00") : null));
            }
            OrderResponse order = orders.create(new OrderRequest(buyers.get(random.nextInt(buyers.size())).id(), date,
                    null, lines, null));
            if (i >= 26) {
                continue; // most recent orders stay as draft quotes
            }
            // A failed confirm would mark this whole transaction rollback-only, so check stock first.
            boolean available = lines.stream()
                    .allMatch(l -> products.get(l.productId()).quantityOnHand() >= l.quantity());
            if (!available) {
                continue; // leave it as a draft quote
            }
            orders.confirm(order.id());
            if (i >= 24) {
                continue; // confirmed, not yet invoiced
            }
            InvoiceResponse invoice = invoices.createFromOrder(new CreateInvoiceRequest(order.id(), date, null, null));
            if (i < 16) {
                orders.complete(order.id());
                invoices.recordPayment(invoice.id(), new PaymentRequest(invoice.total(),
                        min(date.plusDays(10 + random.nextInt(15)), today), Payment.Method.BANK_TRANSFER,
                        "TRX-" + (1000 + i), null));
            } else if (i < 20) {
                BigDecimal half = invoice.total().divide(BigDecimal.valueOf(2), 2, java.math.RoundingMode.HALF_UP);
                invoices.recordPayment(invoice.id(), new PaymentRequest(half, min(date.plusDays(7), today),
                        Payment.Method.BANK_TRANSFER, "TRX-" + (1000 + i), "Deposit"));
            }
        }

        leaves.create(new LeaveCreateRequest(staff.get(1).id(), LeaveRequest.Type.ANNUAL, today.plusDays(14),
                today.plusDays(18), "Family trip"));
        leaves.create(new LeaveCreateRequest(staff.get(9).id(), LeaveRequest.Type.ANNUAL, today.plusDays(30),
                today.plusDays(41), "Summer holiday"));
        leaves.create(new LeaveCreateRequest(staff.get(4).id(), LeaveRequest.Type.SICK, today.minusDays(9),
                today.minusDays(8), null));
    }

    /** One login per role, linked to an employee, only when APP_DEMO_USER_PASSWORD is provided. */
    private void createDemoUsers(List<EmployeeResponse> staff) {
        String password = properties.demoData().userPassword();
        if (password == null || password.isBlank()) {
            log.info("APP_DEMO_USER_PASSWORD not set: demo role accounts were not created.");
            return;
        }
        Object[][] accounts = {{"manager", Role.MANAGER, 0}, {"hr", Role.HR, 8}, {"sales", Role.SALES, 1},
                {"warehouse", Role.WAREHOUSE, 3}, {"accountant", Role.ACCOUNTANT, 5}, {"employee", Role.EMPLOYEE, 9}};
        for (Object[] a : accounts) {
            EmployeeResponse e = staff.get((Integer) a[2]);
            String email = a[0] + "@demo.springerp.local";
            userService.create(new CreateUserRequest(email, e.fullName(), (Role) a[1], password));
            users.findByEmail(email).ifPresent(u -> u.setMustChangePassword(false));
            employees.update(e.id(), new EmployeeRequest(e.firstName(), e.lastName(), e.email(), e.phone(),
                    e.jobTitle(), e.department() == null ? null : e.department().id(), null, email,
                    e.employmentType(), e.hireDate(), e.contractEndDate(), null));
        }
    }

    private static PartnerRequest partner(String name, String city, String country) {
        String slug = name.toLowerCase().replaceAll("[^a-z]+", "");
        return new PartnerRequest(name, null, "contact@" + slug + ".example", null, null, null, city, null, country,
                null, true, false, null);
    }

    private static LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }
}
