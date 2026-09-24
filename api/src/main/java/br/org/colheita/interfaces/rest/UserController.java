package br.org.colheita.interfaces.rest;

import br.org.colheita.application.service.UserService;
import br.org.colheita.domain.model.RoleCode;
import br.org.colheita.infrastructure.security.ActorResolver;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    public record CreateUserRequest(@NotBlank @Size(max=140) String name,@Email @NotBlank String email,@Size(min=12,max=128) String password,@NotNull RoleCode role){}
    public record UpdateUserRequest(@NotBlank @Size(max=140) String name,@NotNull RoleCode role,boolean active){}
    public record PasswordRequest(@Size(min=12,max=128) String password){}
    private final UserService users;
    public UserController(UserService users){this.users=users;}
    @GetMapping @PreAuthorize("hasAuthority('users.read')") public Object list(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="")String search,@RequestParam(defaultValue="0")@Min(0)int page,@RequestParam(defaultValue="20")@Min(1)int size){return users.list(ActorResolver.from(jwt),search,page,size);}
    @PostMapping @PreAuthorize("hasAuthority('users.manage')") public Object create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CreateUserRequest b){return users.create(ActorResolver.from(jwt),b.name(),b.email(),b.password(),b.role());}
    @PutMapping("/{id}") @PreAuthorize("hasAuthority('users.manage')") public Object update(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody UpdateUserRequest b){return users.update(ActorResolver.from(jwt),id,b.name(),b.role(),b.active());}
    @PutMapping("/{id}/password") @PreAuthorize("hasAuthority('users.manage')") public void password(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PasswordRequest b){users.resetPassword(ActorResolver.from(jwt),id,b.password());}
}

