package br.org.colheita.interfaces.rest;

import br.org.colheita.application.service.ReportService;
import br.org.colheita.infrastructure.security.ActorResolver;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ReportController {
    private final ReportService reports;
    public ReportController(ReportService reports){this.reports=reports;}
    @GetMapping("/weeks/{weekId}/summary") @PreAuthorize("hasAuthority('reports.read')") public Object summary(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId){return reports.summary(ActorResolver.from(j),weekId);}
    @GetMapping("/audit") @PreAuthorize("hasAuthority('audit.read')") public Object audit(@AuthenticationPrincipal Jwt j,@RequestParam(required=false)String entityType,@RequestParam(required=false)UUID entityId,@RequestParam(defaultValue="100")int limit){return reports.audit(ActorResolver.from(j),entityType,entityId,limit);}
}

