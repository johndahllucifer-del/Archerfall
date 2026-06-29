from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


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