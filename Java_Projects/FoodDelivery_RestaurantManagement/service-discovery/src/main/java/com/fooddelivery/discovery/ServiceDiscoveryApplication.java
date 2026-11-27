package com.fooddelivery.discovery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/** Service registry: every microservice registers here; the gateway and Feign/WebClient resolve "lb://name" through it. */
@SpringBootApplication
@EnableEurekaServer
public class ServiceDiscoveryApplication {
    public static void main(String[] args) { SpringApplication.run(ServiceDiscoveryApplication.class, args); }
}
