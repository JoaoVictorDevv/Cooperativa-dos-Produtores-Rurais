package br.org.colheita.interfaces.rest;

import br.org.colheita.application.port.out.OperationPort;
import br.org.colheita.application.service.OperationService;
import br.org.colheita.infrastructure.security.ActorResolver;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/weeks/{weekId}")
public class OperationController {
    public record SchoolOrderRequest(@NotNull UUID schoolId,@NotNull UUID productId,@NotNull @DecimalMin("0")BigDecimal quantity,@NotNull UUID priceId){}
    public record SchoolDeliveryRequest(@NotNull UUID schoolId,@Pattern(regexp="SEGUNDA|TERCA|EXCEPCIONAL")String weekday,@NotNull Instant deliveredAt,@Size(max=500)String note){}
    public record SchoolReturnRequest(@NotNull UUID schoolId,@NotNull UUID productId,@NotNull @DecimalMin("0")BigDecimal quantity,@NotNull UUID reasonId){}
    public record ProducerAllocationRequest(@NotNull UUID producerId,@NotNull UUID productId,@NotNull @DecimalMin("0")BigDecimal quantity){}
    public record ProducerOrderRequest(@NotNull UUID producerId,@NotNull UUID productId,@NotNull @DecimalMin("0")BigDecimal quantity,@NotNull UUID priceId){}
    public record ProducerDeliveryRequest(@NotNull UUID producerId,@NotNull UUID productId,@NotNull @DecimalMin("0")BigDecimal quantity,@NotNull Instant deliveredAt,@NotNull UUID priceId,@NotNull @DecimalMin("0")BigDecimal logisticsDeduction){}
    public record ProducerReturnRequest(@NotNull UUID producerId,@NotNull UUID productId,@NotNull @DecimalMin("0")BigDecimal quantity,@NotNull UUID reasonId){}
    public record WeeklyCostRequest(@NotBlank String category,@NotNull @DecimalMin("0")BigDecimal amount){}
    private final OperationService operations;
    public OperationController(OperationService operations){this.operations=operations;}
    @GetMapping("/{resource:school-orders|school-deliveries|school-returns|producer-allocations|producer-orders|producer-deliveries|producer-returns|weekly-costs}") @PreAuthorize("hasAuthority('operations.read')") public Object list(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@PathVariable String resource){return operations.list(ActorResolver.from(j),weekId,resource);}
    @PutMapping("/school-orders") @PreAuthorize("hasAuthority('operations.write')") public Map<String,UUID> schoolOrder(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@Valid @RequestBody SchoolOrderRequest b){return id(operations.schoolOrder(ActorResolver.from(j),weekId,new OperationPort.SchoolOrder(b.schoolId(),b.productId(),b.quantity(),b.priceId())));}
    @PutMapping("/school-deliveries") @PreAuthorize("hasAuthority('operations.write')") public Map<String,UUID> schoolDelivery(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@Valid @RequestBody SchoolDeliveryRequest b){return id(operations.schoolDelivery(ActorResolver.from(j),weekId,new OperationPort.SchoolDelivery(b.schoolId(),b.weekday(),b.deliveredAt(),b.note())));}
    @PutMapping("/school-returns") @PreAuthorize("hasAuthority('operations.write')") public Map<String,UUID> schoolReturn(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@Valid @RequestBody SchoolReturnRequest b){return id(operations.schoolReturn(ActorResolver.from(j),weekId,new OperationPort.SchoolReturn(b.schoolId(),b.productId(),b.quantity(),b.reasonId())));}
    @PutMapping("/producer-allocations") @PreAuthorize("hasAuthority('operations.write')") public Map<String,UUID> producerAllocation(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@Valid @RequestBody ProducerAllocationRequest b){return id(operations.producerAllocation(ActorResolver.from(j),weekId,new OperationPort.ProducerAllocation(b.producerId(),b.productId(),b.quantity())));}
    @PutMapping("/producer-orders") @PreAuthorize("hasAuthority('operations.write')") public Map<String,UUID> producerOrder(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@Valid @RequestBody ProducerOrderRequest b){return id(operations.producerOrder(ActorResolver.from(j),weekId,new OperationPort.ProducerOrder(b.producerId(),b.productId(),b.quantity(),b.priceId())));}
    @PutMapping("/producer-deliveries") @PreAuthorize("hasAuthority('operations.write')") public Map<String,UUID> producerDelivery(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@Valid @RequestBody ProducerDeliveryRequest b){return id(operations.producerDelivery(ActorResolver.from(j),weekId,new OperationPort.ProducerDelivery(b.producerId(),b.productId(),b.quantity(),b.deliveredAt(),b.priceId(),b.logisticsDeduction())));}
    @PutMapping("/producer-returns") @PreAuthorize("hasAuthority('operations.write')") public Map<String,UUID> producerReturn(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@Valid @RequestBody ProducerReturnRequest b){return id(operations.producerReturn(ActorResolver.from(j),weekId,new OperationPort.ProducerReturn(b.producerId(),b.productId(),b.quantity(),b.reasonId())));}
    @PutMapping("/weekly-costs") @PreAuthorize("hasAuthority('finance.write')") public Map<String,UUID> weeklyCost(@AuthenticationPrincipal Jwt j,@PathVariable UUID weekId,@Valid @RequestBody WeeklyCostRequest b){return id(operations.weeklyCost(ActorResolver.from(j),weekId,new OperationPort.WeeklyCost(b.category(),b.amount())));}
    private Map<String,UUID> id(UUID id){return Map.of("id",id);}
}

