package com.tradebidz.core_service.core.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI tradeBidzOpenAPI() {
        return new OpenAPI()
                .info(new Info().title("TradeBidz Core Service API")
                        .description("Core service API documentation")
                        .version("1.0"));
    }
}
