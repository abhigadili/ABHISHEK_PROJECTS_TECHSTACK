package com.hrportal.common.openapi;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

/** OpenAPI / Swagger metadata shared by all services: JWT bearer scheme + service title. UI at /swagger-ui.html. */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI hrOpenApi(@Value("${spring.application.name}") String service) {
        return new OpenAPI()
                .info(new Info().title(service + " API").version("v1").description("HR Portal microservice: " + service))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }
}
