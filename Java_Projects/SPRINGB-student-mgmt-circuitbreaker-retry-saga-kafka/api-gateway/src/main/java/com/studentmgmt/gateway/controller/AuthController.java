package com.studentmgmt.gateway.controller;

import com.studentmgmt.gateway.client.StudentLoginClient;
import com.studentmgmt.gateway.dto.LoginRequest;
import com.studentmgmt.gateway.dto.LoginResponse;
import com.studentmgmt.gateway.security.JwtUtil;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * The only place in the whole system a JWT is minted. This is a LOCAL
 * WebFlux controller endpoint, not a proxied gateway route — /auth/login
 * doesn't match any of the Path predicates in application.yml, so it's
 * never touched by GatewayAuthFilter. Credential checking itself is
 * delegated to student-service (the owner of Student_Login data) via
 * StudentLoginClient; only the token minting and every subsequent request's
 * validation happen here, centrally.
 */
@RestController
public class AuthController {

    private final StudentLoginClient studentLoginClient;
    private final JwtUtil jwtUtil;

    public AuthController(StudentLoginClient studentLoginClient, JwtUtil jwtUtil) {
        this.studentLoginClient = studentLoginClient;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/auth/login")
    public Mono<ResponseEntity<Object>> login(@Valid @RequestBody LoginRequest request) {
        return studentLoginClient.verify(request.getUsername(), request.getPassword())
                .map(result -> {
                    if (!result.isValid()) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .<Object>body("Invalid username/password, or account inactive");
                    }
                    String token = jwtUtil.generateToken(result.getUsername(), result.getRole());
                    return ResponseEntity.ok().<Object>body(new LoginResponse(token));
                });
    }
}
