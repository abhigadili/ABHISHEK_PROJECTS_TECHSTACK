package com.fooddelivery.user.security;

import com.fooddelivery.user.domain.User;
import com.fooddelivery.user.domain.UserStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;

/** Spring Security's view of a {@link User}. */
public record AppUserDetails(User user) implements UserDetails {
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return user.getRoles().stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r.name())).toList();
    }
    @Override public String getPassword() { return user.getPasswordHash(); }
    @Override public String getUsername() { return user.getUsername(); }
    @Override public boolean isEnabled() { return user.getStatus() == UserStatus.ACTIVE; }
}
