package com.example.student.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.example.common.exception.ConflictException;
import com.example.common.exception.UnauthorizedException;
import com.example.common.security.AuthenticatedUser;
import com.example.common.security.JwtProperties;
import com.example.common.security.JwtTokenService;
import com.example.student.dto.AuthDtos.*;
import com.example.student.dto.StudentResponse;
import com.example.student.entity.RefreshToken;
import com.example.student.entity.Role;
import com.example.student.entity.UserAccount;
import com.example.student.repository.RefreshTokenRepository;
import com.example.student.repository.UserAccountRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock UserAccountRepository users;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock StudentService students;
    PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    JwtTokenService jwt;
    AuthService auth;

    @BeforeEach
    void setUp() {
        JwtProperties p = new JwtProperties();
        p.setSecret("unit-test-secret-unit-test-secret-1234");
        jwt = new JwtTokenService(p);
        auth = new AuthService(users, refreshTokens, encoder, jwt, students);
    }

    private UserAccount user(String password, Role role) {
        UserAccount u = new UserAccount();
        u.setUserId(9L); u.setUsername("asha"); u.setEmail("asha@example.com"); u.setRole(role); u.setPasswordHash(encoder.encode(password));
        return u;
    }

    @Test
    void anonymousCallerCannotCreatePrivilegedAccounts() {
        var req = new RegisterRequest("boss", "boss@example.com", "Passw0rd!", Role.ADMIN, null, null, null);
        assertThatThrownBy(() -> auth.register(req, null)).isInstanceOf(AccessDeniedException.class);
        var staff = new AuthenticatedUser(1L, "staff", List.of("STAFF"), null);
        assertThatThrownBy(() -> auth.register(req, staff)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(students);
    }

    @Test
    void studentRegistrationCreatesProfileAndStoresOnlyABcryptHash() {
        when(students.create(any())).thenReturn(new StudentResponse(77L, "A", "B", "a@b.com", null, null, null, null, null, null, null, null));
        when(users.save(any(UserAccount.class))).thenAnswer(i -> i.getArgument(0));

        UserResponse r = auth.register(new RegisterRequest("asha", "A@B.com", "Passw0rd!", null, "Asha", "Rao", null), null);

        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        verify(users).save(saved.capture());
        assertThat(r.role()).isEqualTo(Role.STUDENT);
        assertThat(r.studentId()).isEqualTo(77L);
        assertThat(saved.getValue().getPasswordHash()).isNotEqualTo("Passw0rd!").startsWith("$2");
        assertThat(encoder.matches("Passw0rd!", saved.getValue().getPasswordHash())).isTrue();
    }

    @Test
    void adminMayCreateStaffWithoutStudentProfile() {
        when(users.save(any(UserAccount.class))).thenAnswer(i -> i.getArgument(0));
        var admin = new AuthenticatedUser(1L, "admin", List.of("ADMIN"), null);
        UserResponse r = auth.register(new RegisterRequest("staff1", "s@example.com", "Passw0rd!", Role.STAFF, null, null, null), admin);
        assertThat(r.role()).isEqualTo(Role.STAFF);
        assertThat(r.studentId()).isNull();
        verifyNoInteractions(students);
    }

    @Test
    void duplicateUsernameIsAConflict() {
        when(users.existsByUsernameIgnoreCase("asha")).thenReturn(true);
        assertThatThrownBy(() -> auth.register(new RegisterRequest("asha", "x@example.com", "Passw0rd!", null, "A", "B", null), null))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void loginIssuesJwtWithRoleAndRefreshTokenStoredAsHash() {
        when(users.findByUsernameIgnoreCase("asha")).thenReturn(Optional.of(user("Passw0rd!", Role.STAFF)));
        TokenResponse t = auth.login(new LoginRequest("asha", "Passw0rd!"));
        assertThat(jwt.parse(t.accessToken()).orElseThrow().roles()).containsExactly("STAFF");
        ArgumentCaptor<RefreshToken> rt = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokens).save(rt.capture());
        assertThat(rt.getValue().getTokenHash()).hasSize(64).isNotEqualTo(t.refreshToken());
        assertThat(rt.getValue().getTokenHash()).isEqualTo(AuthService.hash(t.refreshToken()));
    }

    @Test
    void loginFailsForWrongPasswordAndUnknownUserWithTheSameError() {
        when(users.findByUsernameIgnoreCase("asha")).thenReturn(Optional.of(user("Passw0rd!", Role.STAFF)));
        when(users.findByUsernameIgnoreCase("ghost")).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase("ghost")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> auth.login(new LoginRequest("asha", "nope"))).isInstanceOf(UnauthorizedException.class).hasMessage("Invalid username or password");
        assertThatThrownBy(() -> auth.login(new LoginRequest("ghost", "nope"))).isInstanceOf(UnauthorizedException.class).hasMessage("Invalid username or password");
    }

    @Test
    void refreshRotatesTokenAndRejectsReuse() {
        RefreshToken stored = new RefreshToken();
        stored.setUserId(9L); stored.setExpiresAt(LocalDateTime.now().plusDays(1));
        when(refreshTokens.findByTokenHash(AuthService.hash("raw"))).thenReturn(Optional.of(stored));
        when(users.findById(9L)).thenReturn(Optional.of(user("x", Role.STUDENT)));

        TokenResponse t = auth.refresh("raw");

        assertThat(stored.isRevoked()).isTrue();
        assertThat(t.refreshToken()).isNotEqualTo("raw");
        assertThatThrownBy(() -> auth.refresh("raw")).isInstanceOf(UnauthorizedException.class);   // revoked now
    }

    @Test
    void refreshRejectsExpiredAndUnknownTokens() {
        RefreshToken expired = new RefreshToken();
        expired.setUserId(9L); expired.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        when(refreshTokens.findByTokenHash(AuthService.hash("old"))).thenReturn(Optional.of(expired));
        when(refreshTokens.findByTokenHash(AuthService.hash("unknown"))).thenReturn(Optional.empty());
        assertThatThrownBy(() -> auth.refresh("old")).isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> auth.refresh("unknown")).isInstanceOf(UnauthorizedException.class);
    }
}
