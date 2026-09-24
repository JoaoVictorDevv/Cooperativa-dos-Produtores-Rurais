package br.org.colheita.interfaces.rest;

import br.org.colheita.application.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    public record LoginRequest(@Email @NotBlank String email,@NotBlank String password,String organization) {}
    public record RefreshRequest(@NotBlank String refreshToken) {}
    private final AuthService auth;
    public AuthController(AuthService auth){this.auth=auth;}
    @PostMapping("/login") public AuthService.Session login(@Valid @RequestBody LoginRequest body,HttpServletRequest request){return auth.login(body.email(),body.password(),body.organization(),request.getHeader("User-Agent"),clientIp(request));}
    @PostMapping("/refresh") public AuthService.Session refresh(@Valid @RequestBody RefreshRequest body,HttpServletRequest request){return auth.refresh(body.refreshToken(),request.getHeader("User-Agent"),clientIp(request));}
    @PostMapping("/logout") public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest body){auth.logout(body.refreshToken());return ResponseEntity.noContent().build();}
    private String clientIp(HttpServletRequest request){String forwarded=request.getHeader("X-Forwarded-For");return forwarded==null?request.getRemoteAddr():forwarded.split(",")[0].trim();}
}

