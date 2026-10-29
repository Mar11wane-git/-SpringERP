package com.springerp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SpringErpApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpringErpApplication.class, args);
    }
}
