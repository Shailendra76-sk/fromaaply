from __future__ import annotations
import json
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
from .admin_routes import AdminContext, require_system_admin
from .database import get_db

router = APIRouter(prefix="/v1/admin/privacy", tags=["admin-privacy"])
DEFAULT_ROLES = {
    "super_admin": ["privacy.read", "privacy.unmask.request", "privacy.export", "privacy.delete", "security.freeze"],
    "privacy_admin": ["privacy.read", "privacy.unmask.request", "privacy.export", "privacy.delete"],
    "support_admin": ["privacy.read_masked"],
    "operations_admin": ["privacy.read", "security.freeze"],
    "finance_admin": ["privacy.read_masked"],
    "read_only_auditor": ["privacy.read_masked", "privacy.audit.read"],
}
DEFAULT_RETENTION = {"profile": 3650, "documents": 730, "workflow_history": 365, "browser_sessions": 90, "audit_logs": 2555}

def _get_setting(db: Session, key: str, fallback: Any) -> Any:
    raw = db.execute(text("SELECT setting_value_json FROM platform_settings WHERE setting_key=:key"), {"key": key}).scalar()
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return fallback

def _save_setting(db: Session, key: str, value: Any, admin_id: str) -> None:
    db.execute(text("INSERT INTO platform_settings(setting_key,setting_value_json,updated_by,updated_at) VALUES (:key,:value,:admin,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value_json=:value,updated_by=:admin,updated_at=CURRENT_TIMESTAMP"), {"key": key, "value": json.dumps(value, sort_keys=True), "admin": admin_id})
    db.commit()

def _audit(db: Session, admin_id: str, action: str, resource_type: str, resource_id: str | None = None) -> None:
    db.execute(text("INSERT INTO audit_logs(id,user_id,action,resource_type,resource_id,created_at) VALUES (:audit_id,:user,:action,:resource,:id,CURRENT_TIMESTAMP)"), {"audit_id": str(uuid4()), "user": admin_id, "action": action, "resource": resource_type, "id": resource_id})
    db.commit()

class RolePolicyRequest(BaseModel):
    role: str = Field(min_length=3, max_length=80)
    permissions: list[str] = Field(max_length=30)
class RetentionPolicyRequest(BaseModel):
    category: str = Field(min_length=2, max_length=80)
    days: int = Field(ge=1, le=36500)
class PrivacyRequestCreate(BaseModel):
    request_type: str = Field(pattern="^(export|delete|unmask|revoke_sessions)$")
    user_id: str = Field(min_length=1, max_length=128)
    reason: str = Field(min_length=8, max_length=500)

@router.get("/governance")
def governance(db: Session = Depends(get_db), admin: AdminContext = Depends(require_system_admin)) -> dict[str, Any]:
    return {"roles": _get_setting(db, "privacy_roles", DEFAULT_ROLES), "retention": _get_setting(db, "privacy_retention", DEFAULT_RETENTION), "requests": _get_setting(db, "privacy_requests", [])}

@router.put("/roles")
def update_role(body: RolePolicyRequest, db: Session = Depends(get_db), admin: AdminContext = Depends(require_system_admin)) -> dict[str, Any]:
    roles = _get_setting(db, "privacy_roles", DEFAULT_ROLES)
    roles[body.role.strip().lower()] = sorted(set(item.strip().lower() for item in body.permissions if item.strip()))
    _save_setting(db, "privacy_roles", roles, admin.user_id)
    _audit(db, admin.user_id, "privacy.role_policy.updated", "privacy_role", body.role)
    return {"role": body.role, "permissions": roles[body.role.strip().lower()]}

@router.put("/retention")
def update_retention(body: RetentionPolicyRequest, db: Session = Depends(get_db), admin: AdminContext = Depends(require_system_admin)) -> dict[str, Any]:
    retention = _get_setting(db, "privacy_retention", DEFAULT_RETENTION)
    retention[body.category.strip().lower()] = body.days
    _save_setting(db, "privacy_retention", retention, admin.user_id)
    _audit(db, admin.user_id, "privacy.retention.updated", "privacy_retention", body.category)
    return {"category": body.category, "days": body.days}

@router.post("/requests", status_code=201)
def create_privacy_request(body: PrivacyRequestCreate, db: Session = Depends(get_db), admin: AdminContext = Depends(require_system_admin)) -> dict[str, Any]:
    requests = _get_setting(db, "privacy_requests", [])
    item = {"request_id": str(uuid4()), "request_type": body.request_type, "user_id": body.user_id, "reason": body.reason, "status": "PENDING_REVIEW", "created_at": datetime.utcnow().isoformat(), "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat()}
    requests.insert(0, item)
    _save_setting(db, "privacy_requests", requests[:500], admin.user_id)
    _audit(db, admin.user_id, f"privacy.request.created.{body.request_type}", "privacy_request", item["request_id"])
    return item
