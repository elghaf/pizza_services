#!/usr/bin/env python3
"""
Message Broker Service for Pizza Store Detection System
Implements RabbitMQ-based messaging for service communication
"""

import os
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Callable, List
from dataclasses import dataclass

import aio_pika
from aio_pika import Message, DeliveryMode
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Message Broker Service", version="1.0.0")

@dataclass
class MessageBrokerConfig:
    """Configuration for message broker"""
    rabbitmq_url: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    exchange_name: str = "pizza_store_exchange"
    queue_prefix: str = "pizza_store"
    message_ttl: int = 300000  # 5 minutes in milliseconds
    max_retries: int = 3

class MessageTypes:
    """Message type constants"""
    FRAME_DETECTION = "frame.detection"
    VIOLATION_ANALYSIS = "violation.analysis"
    ROI_UPDATE = "roi.update"
    WORKER_TRACKING = "worker.tracking"
    SYSTEM_HEALTH = "system.health"
    VIOLATION_DETECTED = "violation.detected"
    FRAME_PROCESSED = "frame.processed"

class MessageBroker:
    """RabbitMQ-based message broker for service communication"""
    
    def __init__(self, config: MessageBrokerConfig):
        self.config = config
        self.connection = None
        self.channel = None
        self.exchange = None
        self.subscribers: Dict[str, List[Callable]] = {}
        self.queues: Dict[str, aio_pika.Queue] = {}
        
    async def initialize(self):
        """Initialize RabbitMQ connection and setup exchanges/queues"""
        try:
            logger.info("🔌 Connecting to RabbitMQ...")
            self.connection = await aio_pika.connect_robust(self.config.rabbitmq_url)
            self.channel = await self.connection.channel()

            # Declare exchange
            self.exchange = await self.channel.declare_exchange(
                self.config.exchange_name,
                aio_pika.ExchangeType.TOPIC,
                durable=True
            )

            # Setup default queues
            await self._setup_queues()

            logger.info("✅ Message broker initialized successfully")

        except Exception as e:
            logger.warning(f"⚠️ RabbitMQ connection failed: {e}")
            logger.info("🔄 Running in HTTP-only mode (messages will be logged but not queued)")
            # Continue without RabbitMQ for testing
    
    async def _setup_queues(self):
        """Setup default queues for different message types"""
        queue_configs = [
            ("detection_queue", [MessageTypes.FRAME_DETECTION]),
            ("violation_queue", [MessageTypes.VIOLATION_ANALYSIS, MessageTypes.VIOLATION_DETECTED]),
            ("roi_queue", [MessageTypes.ROI_UPDATE]),
            ("tracking_queue", [MessageTypes.WORKER_TRACKING]),
            ("health_queue", [MessageTypes.SYSTEM_HEALTH]),
            ("processing_queue", [MessageTypes.FRAME_PROCESSED])
        ]
        
        for queue_name, routing_keys in queue_configs:
            full_queue_name = f"{self.config.queue_prefix}.{queue_name}"
            
            # Declare queue
            queue = await self.channel.declare_queue(
                full_queue_name,
                durable=True,
                arguments={
                    "x-message-ttl": self.config.message_ttl,
                    "x-max-retries": self.config.max_retries
                }
            )
            
            # Bind to routing keys
            for routing_key in routing_keys:
                await queue.bind(self.exchange, routing_key)
            
            self.queues[queue_name] = queue
            logger.info(f"📦 Queue '{full_queue_name}' setup with routing keys: {routing_keys}")
    
    async def publish_message(self, routing_key: str, message_data: Dict[str, Any],
                            priority: int = 0, correlation_id: str = None) -> bool:
        """Publish message to exchange"""
        try:
            # Add metadata
            message_data.update({
                "timestamp": datetime.now().isoformat(),
                "routing_key": routing_key,
                "broker_metadata": {
                    "published_at": datetime.now().isoformat(),
                    "priority": priority,
                    "correlation_id": correlation_id
                }
            })

            # If RabbitMQ is available, publish to exchange
            if self.exchange:
                message = Message(
                    json.dumps(message_data).encode(),
                    delivery_mode=DeliveryMode.PERSISTENT,
                    priority=priority,
                    correlation_id=correlation_id,
                    timestamp=datetime.now()
                )

                await self.exchange.publish(message, routing_key=routing_key)
                logger.info(f"📤 Published message to RabbitMQ: {routing_key}")
            else:
                # HTTP-only mode: just log the message
                logger.info(f"📤 Message logged (HTTP-only mode): {routing_key}")
                logger.debug(f"Message data: {json.dumps(message_data, indent=2)}")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to publish message {routing_key}: {e}")
            return False
    
    async def subscribe_to_queue(self, queue_name: str, callback: Callable):
        """Subscribe to a queue with callback"""
        try:
            if queue_name not in self.queues:
                logger.error(f"❌ Queue '{queue_name}' not found")
                return False
            
            queue = self.queues[queue_name]
            
            async def message_handler(message: aio_pika.IncomingMessage):
                async with message.process():
                    try:
                        data = json.loads(message.body.decode())
                        await callback(data)
                        logger.info(f"✅ Processed message from {queue_name}")
                    except Exception as e:
                        logger.error(f"❌ Error processing message from {queue_name}: {e}")
                        raise
            
            await queue.consume(message_handler)
            logger.info(f"👂 Subscribed to queue: {queue_name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to subscribe to queue {queue_name}: {e}")
            return False
    
    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get statistics for all queues"""
        stats = {}
        try:
            for queue_name, queue in self.queues.items():
                queue_info = await queue.channel.queue_declare(queue.name, passive=True)
                stats[queue_name] = {
                    "message_count": queue_info.method.message_count,
                    "consumer_count": queue_info.method.consumer_count,
                    "queue_name": queue.name
                }
        except Exception as e:
            logger.error(f"❌ Error getting queue stats: {e}")
        
        return stats
    
    async def close(self):
        """Close connection"""
        if self.connection:
            await self.connection.close()
            logger.info("🔌 Message broker connection closed")

# Global instances
config = MessageBrokerConfig()
broker = MessageBroker(config)

# API Models
class PublishMessageRequest(BaseModel):
    routing_key: str
    message_data: Dict[str, Any]
    priority: int = 0
    correlation_id: Optional[str] = None

class MessageResponse(BaseModel):
    success: bool
    message: str
    timestamp: str

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "message_broker",
        "version": "1.0.0",
        "rabbitmq_connected": broker.connection is not None and not broker.connection.is_closed
    }

@app.post("/publish", response_model=MessageResponse)
async def publish_message(request: PublishMessageRequest):
    """Publish message to exchange"""
    success = await broker.publish_message(
        request.routing_key,
        request.message_data,
        request.priority,
        request.correlation_id
    )
    
    return MessageResponse(
        success=success,
        message="Message published successfully" if success else "Failed to publish message",
        timestamp=datetime.now().isoformat()
    )

@app.get("/queues/stats")
async def get_queue_statistics():
    """Get queue statistics"""
    return await broker.get_queue_stats()

@app.get("/message_types")
async def get_message_types():
    """Get available message types"""
    return {
        "message_types": {
            "FRAME_DETECTION": MessageTypes.FRAME_DETECTION,
            "VIOLATION_ANALYSIS": MessageTypes.VIOLATION_ANALYSIS,
            "ROI_UPDATE": MessageTypes.ROI_UPDATE,
            "WORKER_TRACKING": MessageTypes.WORKER_TRACKING,
            "SYSTEM_HEALTH": MessageTypes.SYSTEM_HEALTH,
            "VIOLATION_DETECTED": MessageTypes.VIOLATION_DETECTED,
            "FRAME_PROCESSED": MessageTypes.FRAME_PROCESSED
        },
        "routing_patterns": {
            "detection": "frame.detection",
            "violations": "violation.*",
            "roi": "roi.*",
            "tracking": "worker.tracking",
            "health": "system.health"
        }
    }

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize message broker on startup"""
    try:
        await broker.initialize()
        logger.info("🚀 Message Broker Service started")
    except Exception as e:
        logger.error(f"❌ Failed to start message broker: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Close connections on shutdown"""
    await broker.close()
    logger.info("🛑 Message Broker Service stopped")

if __name__ == "__main__":
    logger.info("Starting Message Broker Service")
    uvicorn.run(app, host="0.0.0.0", port=8010)
