from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
    CheckoutSessionRequest,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# ===== Leaderboard =====
class LeaderboardSubmit(BaseModel):
    name: str = Field(..., min_length=2, max_length=16)
    level: int = Field(..., ge=1)
    score: int = Field(..., ge=0)


class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    level: int
    score: int
    updated_at: str


@api_router.post("/leaderboard/submit", response_model=LeaderboardEntry)
async def submit_leaderboard(payload: LeaderboardSubmit):
    name = payload.name.strip()
    safe_name = "".join(ch for ch in name if ch.isalnum() or ch in "-_ ").strip()[:16]
    if len(safe_name) < 2:
        safe_name = "Archer"
    now_iso = datetime.now(timezone.utc).isoformat()
    existing = await db.leaderboard.find_one({"name_lc": safe_name.lower()}, {"_id": 0})
    new_entry = {
        "name": safe_name,
        "name_lc": safe_name.lower(),
        "level": payload.level,
        "score": payload.score,
        "updated_at": now_iso,
    }
    if existing:
        # Keep best: higher level wins; tie-break by score
        better = (
            payload.level > existing["level"]
            or (payload.level == existing["level"] and payload.score > existing["score"])
        )
        if better:
            await db.leaderboard.update_one(
                {"name_lc": safe_name.lower()},
                {"$set": new_entry},
            )
        else:
            new_entry = existing
    else:
        await db.leaderboard.insert_one(new_entry)
    return LeaderboardEntry(**new_entry)


@api_router.get("/leaderboard/top", response_model=List[LeaderboardEntry])
async def get_leaderboard_top(limit: int = 100):
    limit = max(1, min(100, limit))
    rows = (
        await db.leaderboard.find({}, {"_id": 0, "name_lc": 0})
        .sort([("level", -1), ("score", -1)])
        .to_list(limit)
    )
    return rows


# ===== Payments / Coin Shop / Support =====
COIN_PACKS: Dict[str, Dict] = {
    "starter":  {"coins": 200,  "amount": 1.00,  "label": "Starter Quiver"},
    "archer":   {"coins": 1100, "amount": 5.00,  "label": "Archer's Bundle"},
    "ranger":   {"coins": 2500, "amount": 10.00, "label": "Ranger's Stash"},
    "legend":   {"coins": 6000, "amount": 20.00, "label": "Legend's Hoard"},
}
SUPPORT_TIERS: Dict[str, float] = {
    "tip_1": 1.00, "tip_3": 3.00, "tip_5": 5.00,
    "tip_10": 10.00, "tip_25": 25.00, "tip_50": 50.00,
}


def _stripe_client(request: Request) -> StripeCheckout:
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(500, "Stripe not configured")
    host = str(request.base_url).rstrip("/")
    webhook_url = f"{host}/api/webhook/stripe"
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


class CheckoutCoinsRequest(BaseModel):
    package_id: str
    origin_url: str
    player_name: str


class CheckoutSupportRequest(BaseModel):
    tier_id: Optional[str] = None
    custom_amount: Optional[float] = None
    origin_url: str
    message: Optional[str] = None


@api_router.post("/payments/coins/checkout")
async def coins_checkout(payload: CheckoutCoinsRequest, request: Request):
    pack = COIN_PACKS.get(payload.package_id)
    if not pack:
        raise HTTPException(400, "Invalid package")
    name = (payload.player_name or "").strip()[:16]
    if len(name) < 2:
        raise HTTPException(400, "Invalid player name")
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/?payment=coins&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/?payment=cancel"
    stripe_checkout = _stripe_client(request)
    metadata = {
        "purpose": "coins",
        "package_id": payload.package_id,
        "coins": str(pack["coins"]),
        "player_name": name,
    }
    req = CheckoutSessionRequest(
        amount=float(pack["amount"]), currency="usd",
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "purpose": "coins",
        "package_id": payload.package_id,
        "coins": pack["coins"],
        "player_name": name,
        "amount": pack["amount"],
        "currency": "usd",
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api_router.post("/payments/support/checkout")
async def support_checkout(payload: CheckoutSupportRequest, request: Request):
    if payload.tier_id:
        amount = SUPPORT_TIERS.get(payload.tier_id)
        if amount is None:
            raise HTTPException(400, "Invalid tier")
    elif payload.custom_amount is not None:
        amount = float(payload.custom_amount)
        if amount < 1.0 or amount > 500.0:
            raise HTTPException(400, "Amount must be between $1 and $500")
        amount = round(amount, 2)
    else:
        raise HTTPException(400, "Provide tier_id or custom_amount")
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/?payment=support&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/?payment=cancel"
    stripe_checkout = _stripe_client(request)
    metadata = {
        "purpose": "support",
        "message": (payload.message or "")[:140],
    }
    req = CheckoutSessionRequest(
        amount=float(amount), currency="usd",
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "purpose": "support",
        "amount": float(amount),
        "currency": "usd",
        "message": (payload.message or "")[:140],
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/payments/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Session not found")
    if txn.get("payment_status") == "paid":
        return {
            "session_id": session_id,
            "payment_status": "paid",
            "status": txn.get("status"),
            "purpose": txn.get("purpose"),
            "coins_credited": txn.get("coins_credited", 0),
        }
    stripe_checkout = _stripe_client(request)
    status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    update = {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    coins_credited = 0
    # Idempotent: only credit once
    if status.payment_status == "paid" and txn.get("payment_status") != "paid":
        if txn.get("purpose") == "coins":
            coins = int(txn.get("coins", 0))
            name = txn.get("player_name")
            if name and coins > 0:
                await db.player_coins.update_one(
                    {"name_lc": name.lower()},
                    {
                        "$inc": {"coins": coins},
                        "$set": {"name": name, "updated_at": update["updated_at"]},
                    },
                    upsert=True,
                )
                update["coins_credited"] = coins
                coins_credited = coins
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update})
    return {
        "session_id": session_id,
        "payment_status": status.payment_status,
        "status": status.status,
        "purpose": txn.get("purpose"),
        "coins_credited": coins_credited,
    }


@api_router.get("/payments/coins/balance")
async def coins_balance(name: str):
    if not name:
        raise HTTPException(400, "name required")
    doc = await db.player_coins.find_one({"name_lc": name.lower()}, {"_id": 0})
    return {"name": name, "purchased_coins": int(doc.get("coins", 0)) if doc else 0}


@api_router.post("/payments/coins/consume")
async def coins_consume(payload: dict):
    """Player has spent purchased coins on their device; drain the server side balance.
    Idempotency is best-effort; the source of truth is the client localStorage. We only
    track purchased-coin balance to remember how much was bought."""
    name = (payload.get("name") or "").strip()
    amount = int(payload.get("amount") or 0)
    if not name or amount <= 0:
        raise HTTPException(400, "name and positive amount required")
    doc = await db.player_coins.find_one({"name_lc": name.lower()})
    if not doc:
        return {"ok": True, "remaining": 0}
    new_val = max(0, int(doc.get("coins", 0)) - amount)
    await db.player_coins.update_one({"name_lc": name.lower()}, {"$set": {"coins": new_val}})
    return {"ok": True, "remaining": new_val}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    stripe_checkout = _stripe_client(request)
    event = await stripe_checkout.handle_webhook(body, sig)
    if event.payment_status == "paid":
        txn = await db.payment_transactions.find_one({"session_id": event.session_id})
        if txn and txn.get("payment_status") != "paid":
            update = {
                "payment_status": "paid",
                "status": "completed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if txn.get("purpose") == "coins":
                coins = int(txn.get("coins", 0))
                name = txn.get("player_name")
                if name and coins > 0:
                    await db.player_coins.update_one(
                        {"name_lc": name.lower()},
                        {"$inc": {"coins": coins}, "$set": {"name": name}},
                        upsert=True,
                    )
                    update["coins_credited"] = coins
            await db.payment_transactions.update_one(
                {"session_id": event.session_id}, {"$set": update}
            )
    return {"received": True}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()