package br.org.colheita;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ColheitaApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(ColheitaApiApplication.class, args);
    }
}

