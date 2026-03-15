from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session

from app.crud import (
    create_endpoint,
    delete_endpoint,
    get_endpoint,
    list_endpoints,
    update_endpoint,
)
from app.db import get_session
from app.schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminSessionRead,
    AdminUserCreate,
    AdminUserRead,
    AdminUserUpdate,
    ChangePasswordRequest,
    EndpointCreate,
    EndpointRead,
    EndpointUpdate,
    PreviewRequest,
    PreviewResponse,
)
from app.services.admin_auth import (
    AdminContext,
    authenticate_admin_user,
    count_active_superusers,
    create_admin_session,
    create_admin_user,
    delete_admin_user,
    get_admin_context,
    get_admin_user,
    list_admin_users,
    require_admin_access,
    require_superuser_access,
    revoke_admin_session,
    revoke_user_sessions,
    update_admin_user,
    update_own_password,
)
from app.services.admin_endpoint_policy import (
    normalize_endpoint_method,
    normalize_endpoint_path,
    validate_endpoint_path,
)
from app.services.mock_generation import preview_from_schema
from app.services.schema_contract import normalize_schema_for_builder


router = APIRouter()


def _normalize_request_schema(schema: dict | None) -> dict:
    return normalize_schema_for_builder(schema or {}, property_name="root", include_mock=False)


def _normalize_response_schema(schema: dict | None) -> dict:
    return normalize_schema_for_builder(schema or {}, property_name="root", include_mock=True)


def _build_session_read(context: AdminContext) -> AdminSessionRead:
    return AdminSessionRead(user=context.user, expires_at=context.session.expires_at)


def _raise_user_input_error(error: ValueError) -> None:
    detail = str(error)
    status_code = status.HTTP_409_CONFLICT if "already in use" in detail.lower() else status.HTTP_400_BAD_REQUEST
    raise HTTPException(status_code=status_code, detail=detail)


def _normalize_endpoint_fields(updates: dict) -> dict:
    normalized_updates = dict(updates)

    if "method" in normalized_updates and normalized_updates["method"] is not None:
        normalized_updates["method"] = normalize_endpoint_method(str(normalized_updates["method"]))

    if "path" in normalized_updates and normalized_updates["path"] is not None:
        normalized_path = normalize_endpoint_path(str(normalized_updates["path"]))
        validate_endpoint_path(normalized_path)
        normalized_updates["path"] = normalized_path

    if "request_schema" in normalized_updates:
        normalized_updates["request_schema"] = _normalize_request_schema(normalized_updates["request_schema"])

    if "response_schema" in normalized_updates:
        normalized_updates["response_schema"] = _normalize_response_schema(normalized_updates["response_schema"])

    return normalized_updates


@router.post("/auth/login", response_model=AdminLoginResponse)
def login_admin(
    payload: AdminLoginRequest,
    session: Session = Depends(get_session),
) -> AdminLoginResponse:
    user = authenticate_admin_user(session, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token, admin_session = create_admin_session(session, user, remember_me=payload.remember_me)
    return AdminLoginResponse(token=token, user=user, expires_at=admin_session.expires_at)


@router.get("/auth/me", response_model=AdminSessionRead)
def read_current_admin_session(context: AdminContext = Depends(get_admin_context)) -> AdminSessionRead:
    return _build_session_read(context)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_admin(
    session: Session = Depends(get_session),
    context: AdminContext = Depends(get_admin_context),
) -> Response:
    revoke_admin_session(session=session, admin_session=context.session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/account/change-password", response_model=AdminSessionRead)
def change_own_password(
    payload: ChangePasswordRequest,
    session: Session = Depends(get_session),
    context: AdminContext = Depends(get_admin_context),
) -> AdminSessionRead:
    try:
        update_own_password(
            session,
            context.user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    revoke_user_sessions(session, context.user.id, exclude_session_id=context.session.id)
    refreshed_user = get_admin_user(session, context.user.id)
    return AdminSessionRead(user=refreshed_user or context.user, expires_at=context.session.expires_at)


@router.get("/users", response_model=list[AdminUserRead])
def list_dashboard_users(
    session: Session = Depends(get_session),
    _: AdminContext = Depends(require_superuser_access),
) -> list[AdminUserRead]:
    return list_admin_users(session)


@router.post("/users", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
def create_dashboard_user(
    payload: AdminUserCreate,
    session: Session = Depends(get_session),
    _: AdminContext = Depends(require_superuser_access),
) -> AdminUserRead:
    try:
        return create_admin_user(
            session,
            username=payload.username,
            password=payload.password,
            is_active=payload.is_active,
            is_superuser=payload.is_superuser,
            must_change_password=payload.must_change_password,
        )
    except ValueError as error:
        _raise_user_input_error(error)


@router.put("/users/{user_id}", response_model=AdminUserRead)
def update_dashboard_user(
    user_id: int,
    payload: AdminUserUpdate,
    session: Session = Depends(get_session),
    context: AdminContext = Depends(require_superuser_access),
) -> AdminUserRead:
    user = get_admin_user(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin user not found.")

    if user.id == context.user.id:
        if payload.password is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use the change-password flow to rotate your own password.",
            )
        if payload.is_active is False or payload.is_superuser is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use another superuser account to change your own role or access.",
            )

    if payload.is_active is False and user.is_active and user.is_superuser and count_active_superusers(session, exclude_user_id=user.id) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mockingbird must keep at least one active superuser.",
        )

    if payload.is_superuser is False and user.is_superuser and user.is_active and count_active_superusers(session, exclude_user_id=user.id) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mockingbird must keep at least one active superuser.",
        )

    try:
        updated_user = update_admin_user(
            session,
            user,
            username=payload.username,
            password=payload.password,
            is_active=payload.is_active,
            is_superuser=payload.is_superuser,
            must_change_password=payload.must_change_password,
        )
    except ValueError as error:
        _raise_user_input_error(error)

    if payload.password is not None or payload.is_active is False:
        revoke_user_sessions(session, updated_user.id)

    return updated_user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard_user(
    user_id: int,
    session: Session = Depends(get_session),
    context: AdminContext = Depends(require_superuser_access),
) -> Response:
    user = get_admin_user(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin user not found.")
    if user.id == context.user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sign in with another superuser account before deleting this one.",
        )
    if user.is_active and user.is_superuser and count_active_superusers(session, exclude_user_id=user.id) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mockingbird must keep at least one active superuser.",
        )

    delete_admin_user(session, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/endpoints", response_model=list[EndpointRead])
def list_all_endpoints(
    session: Session = Depends(get_session),
    _: AdminContext = Depends(require_admin_access),
) -> list[EndpointRead]:
    return list_endpoints(session)


@router.get("/endpoints/{endpoint_id}", response_model=EndpointRead)
def read_endpoint(
    endpoint_id: int,
    session: Session = Depends(get_session),
    _: AdminContext = Depends(require_admin_access),
) -> EndpointRead:
    endpoint = get_endpoint(session, endpoint_id)
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")
    return endpoint


@router.post("/endpoints", response_model=EndpointRead, status_code=status.HTTP_201_CREATED)
def create_new_endpoint(
    endpoint_in: EndpointCreate,
    session: Session = Depends(get_session),
    _: AdminContext = Depends(require_admin_access),
) -> EndpointRead:
    normalized_fields = _normalize_endpoint_fields(
        endpoint_in.model_dump()
    )
    payload = EndpointCreate(**normalized_fields)
    return create_endpoint(session, payload)


@router.put("/endpoints/{endpoint_id}", response_model=EndpointRead)
def update_existing_endpoint(
    endpoint_id: int,
    endpoint_in: EndpointUpdate,
    session: Session = Depends(get_session),
    _: AdminContext = Depends(require_admin_access),
) -> EndpointRead:
    endpoint = get_endpoint(session, endpoint_id)
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    updates = _normalize_endpoint_fields(endpoint_in.model_dump(exclude_unset=True))
    return update_endpoint(session, endpoint, EndpointUpdate(**updates))


@router.delete("/endpoints/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_endpoint(
    endpoint_id: int,
    session: Session = Depends(get_session),
    _: AdminContext = Depends(require_admin_access),
) -> Response:
    endpoint = get_endpoint(session, endpoint_id)
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")
    delete_endpoint(session, endpoint)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/endpoints/preview-response", response_model=PreviewResponse)
def preview_response(
    payload: PreviewRequest,
    _: AdminContext = Depends(require_admin_access),
) -> PreviewResponse:
    return PreviewResponse(
        preview=preview_from_schema(
            _normalize_response_schema(payload.response_schema),
            seed_key=payload.seed_key,
            identity="preview",
        ),
    )
