package com.cricket.repository.impl;

import com.cricket.model.LoginUser;
import com.cricket.repository.LoginUserRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public class LoginUserRepositoryImpl implements LoginUserRepository {

    private final JdbcTemplate jdbcTemplate;

    public LoginUserRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<LoginUser> ROW_MAPPER = (rs, rowNum) -> {
        LoginUser u = new LoginUser();
        u.setId(rs.getInt("id"));
        u.setName(rs.getString("name"));
        u.setEmail(rs.getString("email"));
        u.setPasswordHash(rs.getString("password_hash"));
        u.setRole(rs.getString("role"));
        u.setActive(rs.getBoolean("is_active"));
        Timestamp lastLogin = rs.getTimestamp("last_login");
        if (lastLogin != null) u.setLastLogin(lastLogin.toLocalDateTime());
        u.setRefreshTokenHash(rs.getString("refresh_token_hash"));
        Timestamp refreshExpires = rs.getTimestamp("refresh_token_expires");
        if (refreshExpires != null) u.setRefreshTokenExpires(refreshExpires.toLocalDateTime());
        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) u.setCreatedAt(createdAt.toLocalDateTime());
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) u.setUpdatedAt(updatedAt.toLocalDateTime());
        return u;
    };

    @Override
    public List<LoginUser> findAll() {
        return jdbcTemplate.query("SELECT * FROM loginusers ORDER BY name", ROW_MAPPER);
    }

    @Override
    public Optional<LoginUser> findById(Integer id) {
        try {
            return Optional.ofNullable(
                    jdbcTemplate.queryForObject("SELECT * FROM loginusers WHERE id = ?", ROW_MAPPER, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }
}
