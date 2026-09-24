package br.org.colheita.interfaces.rest;

import br.org.colheita.application.service.WeekService;
import br.org.colheita.infrastructure.security.ActorResolver;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/weeks")
public class WeekController {
    public record CreateWeekRequest(@NotNull LocalDate referenceDate,@NotNull LocalDate startDate,@NotNull LocalDate endDate,@Size(max=1000)String notes){}
    public record ReopenRequest(@NotBlank @Size(min=10,max=500)String reason){}
    private final WeekService weeks;
    public WeekController(WeekService weeks){this.weeks=weeks;}
    @GetMapping @PreAuthorize("hasAuthority('weeks.read')") public Object list(@AuthenticationPrincipal Jwt j,@RequestParam(required=false)String status,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="30")int size){return weeks.list(ActorResolver.from(j),status,page,size);}
    @GetMapping("/{id}") @PreAuthorize("hasAuthority('weeks.read')") public Object one(@AuthenticationPrincipal Jwt j,@PathVariable UUID id){return weeks.find(ActorResolver.from(j),id);}
    @PostMapping @PreAuthorize("hasAuthority('weeks.write')") public Object create(@AuthenticationPrincipal Jwt j,@Valid @RequestBody CreateWeekRequest b){return weeks.create(ActorResolver.from(j),b.referenceDate(),b.startDate(),b.endDate(),b.notes());}
    @PostMapping("/{id}/close") @PreAuthorize("hasAuthority('weeks.close')") public Object close(@AuthenticationPrincipal Jwt j,@PathVariable UUID id){return weeks.close(ActorResolver.from(j),id);}
    @PostMapping("/{id}/reopen") @PreAuthorize("hasAuthority('weeks.reopen')") public Object reopen(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@Valid @RequestBody ReopenRequest b){return weeks.reopen(ActorResolver.from(j),id,b.reason());}
}

