from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
import uvicorn

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
db_name = os.environ.get('DB_NAME', 'vpn_extension')

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.client = AsyncIOMotorClient(mongo_url)
    app.state.db = app.state.client[db_name]
    logging.info("Connected to MongoDB")
    
    yield
    
    # Shutdown
    app.state.client.close()
    logging.info("Closed MongoDB connection")

# Create the main app with lifespan manager
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class ProxyConnection(BaseModel):
    host: str
    port: int
    protocol: str = "https"

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "VPN Extension Backend Service"}

@api_router.get("/health")
async def health_check():
    try:
        # Test database connection
        await app.state.db.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    await app.state.db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await app.state.db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.post("/connect")
async def connect_proxy(proxy: ProxyConnection):
    """Handle proxy connection request"""
    try:
        logger = logging.getLogger(__name__)
        logger.info(f"Connecting to proxy: {proxy.host}:{proxy.port} ({proxy.protocol})")
        
        await app.state.db.active_proxies.update_one(
            {"type": "active"},
            {"$set": {"proxy": proxy.dict(), "connected_at": datetime.utcnow()}},
            upsert=True
        )
        
        return {"status": "connected", "proxy": proxy.dict()}
        
    except Exception as e:
        logger.error(f"Error connecting to proxy: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/disconnect")
async def disconnect_proxy():
    """Handle proxy disconnection"""
    try:
        logger = logging.getLogger(__name__)
        logger.info("Disconnecting from proxy")
        
        result = await app.state.db.active_proxies.delete_one({"type": "active"})
        
        return {"status": "disconnected", "deleted_count": result.deleted_count}
        
    except Exception as e:
        logger.error(f"Error disconnecting from proxy: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/proxy/status")
async def get_proxy_status():
    """Get current proxy status"""
    try:
        active_proxy = await app.state.db.active_proxies.find_one({"type": "active"})
        if active_proxy:
            return {
                "connected": True,
                "proxy": active_proxy.get("proxy"),
                "connected_at": active_proxy.get("connected_at")
            }
        return {"connected": False}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting proxy status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "chrome-extension://*",  # Allow all Chrome extensions
        "moz-extension://*"      # Allow all Firefox extensions
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Get port from environment variable or use default 8000
    port = int(os.environ.get("PORT", 8000))
    
    # Run the server
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
