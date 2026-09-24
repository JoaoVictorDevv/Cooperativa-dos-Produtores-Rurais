package br.org.colheita.interfaces.rest;

import br.org.colheita.application.service.CatalogService;
import br.org.colheita.infrastructure.security.ActorResolver;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {
    public record ProductRequest(@NotBlank @Pattern(regexp="^[a-z0-9-]+$")String slug,@NotBlank String name,@NotBlank String unit,boolean active){}
    public record SchoolRequest(@NotBlank String code,@NotBlank String name,String neighborhood,String address,String phone,boolean active){}
    public record ProducerRequest(@NotBlank String internalId,@NotBlank String name,String document,String phone,boolean active){}
    public record ReasonRequest(@Positive int code,@NotBlank String description,boolean active){}
    public record PriceRequest(@NotNull UUID productId,@NotNull @DecimalMin("0.00")BigDecimal price,@NotNull Instant validFrom){}
    private final CatalogService catalogs;
    public CatalogController(CatalogService catalogs){this.catalogs=catalogs;}
    @GetMapping("/products") @PreAuthorize("hasAuthority('catalogs.read')") public Object products(@AuthenticationPrincipal Jwt j,@RequestParam(defaultValue="")String search,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size){return catalogs.products(ActorResolver.from(j),search,page,size);}
    @PostMapping("/products") @PreAuthorize("hasAuthority('catalogs.write')") public Object createProduct(@AuthenticationPrincipal Jwt j,@Valid @RequestBody ProductRequest b){return catalogs.saveProduct(ActorResolver.from(j),null,b.slug(),b.name(),b.unit(),b.active());}
    @PutMapping("/products/{id}") @PreAuthorize("hasAuthority('catalogs.write')") public Object updateProduct(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@Valid @RequestBody ProductRequest b){return catalogs.saveProduct(ActorResolver.from(j),id,b.slug(),b.name(),b.unit(),b.active());}
    @GetMapping("/schools") @PreAuthorize("hasAuthority('catalogs.read')") public Object schools(@AuthenticationPrincipal Jwt j,@RequestParam(defaultValue="")String search,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size){return catalogs.schools(ActorResolver.from(j),search,page,size);}
    @PostMapping("/schools") @PreAuthorize("hasAuthority('catalogs.write')") public Object createSchool(@AuthenticationPrincipal Jwt j,@Valid @RequestBody SchoolRequest b){return catalogs.saveSchool(ActorResolver.from(j),null,b.code(),b.name(),b.neighborhood(),b.address(),b.phone(),b.active());}
    @PutMapping("/schools/{id}") @PreAuthorize("hasAuthority('catalogs.write')") public Object updateSchool(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@Valid @RequestBody SchoolRequest b){return catalogs.saveSchool(ActorResolver.from(j),id,b.code(),b.name(),b.neighborhood(),b.address(),b.phone(),b.active());}
    @GetMapping("/producers") @PreAuthorize("hasAuthority('catalogs.read')") public Object producers(@AuthenticationPrincipal Jwt j,@RequestParam(defaultValue="")String search,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size){return catalogs.producers(ActorResolver.from(j),search,page,size);}
    @PostMapping("/producers") @PreAuthorize("hasAuthority('catalogs.write')") public Object createProducer(@AuthenticationPrincipal Jwt j,@Valid @RequestBody ProducerRequest b){return catalogs.saveProducer(ActorResolver.from(j),null,b.internalId(),b.name(),b.document(),b.phone(),b.active());}
    @PutMapping("/producers/{id}") @PreAuthorize("hasAuthority('catalogs.write')") public Object updateProducer(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@Valid @RequestBody ProducerRequest b){return catalogs.saveProducer(ActorResolver.from(j),id,b.internalId(),b.name(),b.document(),b.phone(),b.active());}
    @GetMapping("/return-reasons") @PreAuthorize("hasAuthority('catalogs.read')") public Object reasons(@AuthenticationPrincipal Jwt j,@RequestParam(defaultValue="")String search,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size){return catalogs.reasons(ActorResolver.from(j),search,page,size);}
    @PostMapping("/return-reasons") @PreAuthorize("hasAuthority('catalogs.write')") public Object createReason(@AuthenticationPrincipal Jwt j,@Valid @RequestBody ReasonRequest b){return catalogs.saveReason(ActorResolver.from(j),null,b.code(),b.description(),b.active());}
    @PutMapping("/return-reasons/{id}") @PreAuthorize("hasAuthority('catalogs.write')") public Object updateReason(@AuthenticationPrincipal Jwt j,@PathVariable UUID id,@Valid @RequestBody ReasonRequest b){return catalogs.saveReason(ActorResolver.from(j),id,b.code(),b.description(),b.active());}
    @GetMapping("/prices") @PreAuthorize("hasAuthority('finance.read')") public Object prices(@AuthenticationPrincipal Jwt j,@RequestParam(required=false)UUID productId,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size){return catalogs.prices(ActorResolver.from(j),productId,page,size);}
    @PostMapping("/prices") @PreAuthorize("hasAuthority('finance.write')") public Object price(@AuthenticationPrincipal Jwt j,@Valid @RequestBody PriceRequest b){return catalogs.schedulePrice(ActorResolver.from(j),b.productId(),b.price(),b.validFrom());}
}

