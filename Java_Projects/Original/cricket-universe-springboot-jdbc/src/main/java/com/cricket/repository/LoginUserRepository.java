package com.cricket.repository;

import com.cricket.model.LoginUser;

import java.util.List;
import java.util.Optional;

/** Read-only — see LoginUserService for why there is no insert/update/delete here. */
public interface LoginUserRepository {

    List<LoginUser> findAll();

    Optional<LoginUser> findById(Integer id);
}
