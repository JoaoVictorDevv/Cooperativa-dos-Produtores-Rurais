package br.org.colheita.infrastructure.config;

import br.org.colheita.application.port.out.*;
import br.org.colheita.application.service.*;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApplicationConfig {
    @Bean Clock clock(){return Clock.systemUTC();}
    @Bean AuthService authService(IdentityPort i,PasswordPort p,TokenPort t,UnitOfWorkPort u,Clock c){return new AuthService(i,p,t,u,c);}
    @Bean UserService userService(IdentityPort i,PasswordPort p,AuditPort a,UnitOfWorkPort u){return new UserService(i,p,a,u);}
    @Bean CatalogService catalogService(CatalogPort c,AuditPort a,UnitOfWorkPort u){return new CatalogService(c,a,u);}
    @Bean WeekService weekService(WeekPort w,AuditPort a,UnitOfWorkPort u){return new WeekService(w,a,u);}
    @Bean OperationService operationService(OperationPort o,AuditPort a,UnitOfWorkPort u){return new OperationService(o,a,u);}
    @Bean ReportService reportService(ReportPort r){return new ReportService(r);}
}

