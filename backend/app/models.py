"""FLOWSIGHT database models.

Tables: accounts, transactions, alerts, investigations, audit_logs,
detection_rules, users. Mirrors the Step 1 synthetic corpus so the API can be a
drop-in replacement for the frontend demo data.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    type: Mapped[str] = mapped_column(String(32), default="current")
    institution: Mapped[str] = mapped_column(String(64), default="")
    bank: Mapped[str] = mapped_column(String(64), default="")
    entity: Mapped[str] = mapped_column(String(128), default="")
    city: Mapped[str] = mapped_column(String(64), default="")
    category: Mapped[str] = mapped_column(String(32), default="retail")
    created_date: Mapped[str] = mapped_column(String(32), default="")
    total_sent: Mapped[float] = mapped_column(Float, default=0.0)
    total_received: Mapped[float] = mapped_column(Float, default=0.0)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)

    transactions_out: Mapped[list["Transaction"]] = relationship(
        foreign_keys="Transaction.from_account", back_populates="sender"
    )
    transactions_in: Mapped[list["Transaction"]] = relationship(
        foreign_keys="Transaction.to_account", back_populates="receiver"
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    from_account: Mapped[str] = mapped_column(
        String(32), ForeignKey("accounts.id"), index=True
    )
    to_account: Mapped[str] = mapped_column(
        String(32), ForeignKey("accounts.id"), index=True
    )
    amount: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    channel: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="completed")

    sender: Mapped["Account"] = relationship(
        foreign_keys=[from_account], back_populates="transactions_out"
    )
    receiver: Mapped["Account"] = relationship(
        foreign_keys=[to_account], back_populates="transactions_in"
    )


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    pattern_type: Mapped[str] = mapped_column(String(32), index=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    account_ids: Mapped[list] = mapped_column(JSON)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(24), default="open")
    assigned_to: Mapped[str] = mapped_column(String(64), default="")
    evidence: Mapped[str] = mapped_column(Text, default="")
    transaction_ids: Mapped[list] = mapped_column(JSON)

    investigations: Mapped[list["Investigation"]] = relationship(
        back_populates="alert"
    )


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    alert_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("alerts.id"), index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="open")
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    summary_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    assigned_to: Mapped[str] = mapped_column(String(64), default="")

    alert: Mapped["Alert"] = relationship(back_populates="investigations")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user: Mapped[str] = mapped_column(String(64), default="system")
    action: Mapped[str] = mapped_column(String(128))
    resource: Mapped[str] = mapped_column(String(128), default="")
    result: Mapped[str] = mapped_column(String(24), default="success")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)


class DetectionRule(Base):
    __tablename__ = "detection_rules"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    pattern: Mapped[str] = mapped_column(String(32), default="")
    status: Mapped[str] = mapped_column(String(16), default="enabled")
    sensitivity: Mapped[str] = mapped_column(String(16), default="medium")
    weight: Mapped[int] = mapped_column(Integer, default=0)
    thresholds: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    email: Mapped[str] = mapped_column(String(128), default="")
    role: Mapped[str] = mapped_column(String(32), default="analyst")
    role_key: Mapped[str] = mapped_column(String(32), default="analyst")
    unit: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(16), default="active")
    last_active: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)