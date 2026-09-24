package br.org.colheita.infrastructure.security;

import br.org.colheita.infrastructure.config.SecurityProperties;
import java.util.Arrays;
import javax.crypto.SecretKey;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.*;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder(12);}
    @Bean JwtEncoder jwtEncoder(SecurityProperties p){SecretKey key=SecurityAdapters.secretKey(p);return NimbusJwtEncoder.withSecretKey(key).build();}
    @Bean JwtDecoder jwtDecoder(SecurityProperties p){return NimbusJwtDecoder.withSecretKey(SecurityAdapters.secretKey(p)).macAlgorithm(MacAlgorithm.HS256).build();}
    @Bean JwtAuthenticationConverter jwtAuthenticationConverter(){var authorities=new JwtGrantedAuthoritiesConverter();authorities.setAuthoritiesClaimName("permissions");authorities.setAuthorityPrefix("");var converter=new JwtAuthenticationConverter();converter.setJwtGrantedAuthoritiesConverter(authorities);return converter;}
    @Bean CorsConfigurationSource corsConfigurationSource(SecurityProperties p){var config=new CorsConfiguration();config.setAllowedOrigins(Arrays.stream(p.corsAllowedOrigins().split(",")).map(String::trim).toList());config.setAllowedMethods(java.util.List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));config.setAllowedHeaders(java.util.List.of("Authorization","Content-Type","X-Request-Id"));config.setExposedHeaders(java.util.List.of("X-Request-Id"));config.setAllowCredentials(true);config.setMaxAge(3600L);var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",config);return source;}
    @Bean SecurityFilterChain securityFilterChain(HttpSecurity http,JwtAuthenticationConverter converter) throws Exception{return http.csrf(c->c.disable()).cors(c->{}).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS)).authorizeHttpRequests(a->a.requestMatchers("/api/v1/auth/**","/actuator/health/**").permitAll().requestMatchers(HttpMethod.OPTIONS,"/**").permitAll().anyRequest().authenticated()).oauth2ResourceServer(o->o.jwt(j->j.jwtAuthenticationConverter(converter))).build();}
}

