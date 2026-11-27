from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.deps import AuthServiceDep, CurrentUserDep, client_ip
from app.schemas import (
    ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, LogoutRequest, MessageResponse,
    RefreshRequest, RegisterRequest, ResetPasswordRequest, TokenResponse, UserRead,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED,
             summary="Self-register a STUDENT account (public)")
def register(body: RegisterRequest, svc: AuthServiceDep) -> UserRead:
    return UserRead.model_validate(svc.register(body.email, body.full_name, body.password))


@router.post("/login", response_model=TokenResponse, summary="JSON login (public)")
def login(body: LoginRequest, request: Request, svc: AuthServiceDep) -> TokenResponse:
    user = svc.authenticate(body.email, body.password)
    return svc.issue_tokens(user, client_ip=client_ip(request),
                            user_agent=request.headers.get("user-agent"))


@router.post("/token", response_model=TokenResponse,
             summary="OAuth2 password grant (form-encoded, supports `scope`)")
def oauth2_token(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], request: Request, svc: AuthServiceDep
) -> TokenResponse:
    """RFC 6749 §4.3 *Resource Owner Password Credentials* grant.

    ``username`` is the account e-mail.  ``scope`` (space separated) may narrow
    the granted scopes; without it the token receives every scope the user's
    roles allow.  This is what Swagger UI's *Authorize* button calls.
    """
    user = svc.authenticate(form.username.strip().lower(), form.password)
    return svc.issue_tokens(user, form.scopes or None, client_ip=client_ip(request),
                            user_agent=request.headers.get("user-agent"))


@router.post("/refresh", response_model=TokenResponse,
             summary="Exchange a refresh token for a new pair (rotation)")
def refresh(body: RefreshRequest, request: Request, svc: AuthServiceDep) -> TokenResponse:
    return svc.refresh(body.refresh_token, client_ip=client_ip(request),
                       user_agent=request.headers.get("user-agent"))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT,
             summary="Revoke the refresh token and the current access token")
def logout(body: LogoutRequest, user: CurrentUserDep, svc: AuthServiceDep) -> Response:
    svc.logout(user, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead, summary="Current user")
def me(user: CurrentUserDep, svc: AuthServiceDep) -> UserRead:
    return UserRead.model_validate(svc.get_user(user.id))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT,
             summary="Change my password (revokes all refresh tokens)")
def change_password(body: ChangePasswordRequest, user: CurrentUserDep, svc: AuthServiceDep) -> Response:
    svc.change_password(user.id, body.current_password, body.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED,
             summary="Request a password-reset e-mail (always 202)")
def forgot_password(body: ForgotPasswordRequest, svc: AuthServiceDep) -> MessageResponse:
    svc.forgot_password(body.email.lower())
    return MessageResponse(message="If the account exists, a reset e-mail has been queued")


@router.post("/reset-password", response_model=MessageResponse,
             summary="Set a new password using the e-mailed token")
def reset_password(body: ResetPasswordRequest, svc: AuthServiceDep) -> MessageResponse:
    svc.reset_password(body.token, body.new_password)
    return MessageResponse(message="Password updated; please sign in again")
