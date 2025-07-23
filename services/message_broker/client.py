#!/usr/bin/env python3
"""
Message Broker Client for Pizza Store Detection System
Provides easy-to-use client for services to communicate via RabbitMQ
"""

import os
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass

import aio_pika
from aio_pika import Message, DeliveryMode
import httpx

logger = logging.getLogger(__name__)

@dataclass
class BrokerClientConfig:
    """Configuration for broker client"""
    broker_service_url: str = os.getenv("BROKER_SERVICE_URL", "http://localhost:8010")
    rabbitmq_url: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    service_name: str = "unknown_service"
    use_direct_rabbitmq: bool = False  # If True, connect directly to RabbitMQ

class MessageBrokerClient:
    """Client for communicating with message broker"""
    
    def __init__(self, config: BrokerClientConfig):
        self.config = config
        self.connection = None
        self.channel = None
        self.exchange = None
        self.http_client = None
        
    async def initialize(self):
        """Initialize client connection"""
        try:
            if self.config.use_direct_rabbitmq:
                await self._init_direct_rabbitmq()
            else:
                await self._init_http_client()
            
            logger.info(f"✅ Message broker client initialized for {self.config.service_name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize broker client: {e}")
            raise
    
    async def _init_direct_rabbitmq(self):
        """Initialize direct RabbitMQ connection"""
        self.connection = await aio_pika.connect_robust(self.config.rabbitmq_url)
        self.channel = await self.connection.channel()
        self.exchange = await self.channel.declare_exchange(
            "pizza_store_exchange",
            aio_pika.ExchangeType.TOPIC,
            durable=True
        )
    
    async def _init_http_client(self):
        """Initialize HTTP client for broker service"""
        self.http_client = httpx.AsyncClient(timeout=10.0)
    
    async def publish_message(self, routing_key: str, message_data: Dict[str, Any], 
                            priority: int = 0, correlation_id: str = None) -> bool:
        """Publish message via broker"""
        try:
            # Add service metadata
            message_data.update({
                "source_service": self.config.service_name,
                "published_at": datetime.now().isoformat()
            })
            
            if self.config.use_direct_rabbitmq and self.exchange:
                return await self._publish_direct(routing_key, message_data, priority, correlation_id)
            else:
                return await self._publish_http(routing_key, message_data, priority, correlation_id)
                
        except Exception as e:
            logger.error(f"❌ Failed to publish message {routing_key}: {e}")
            return False
    
    async def _publish_direct(self, routing_key: str, message_data: Dict[str, Any], 
                            priority: int, correlation_id: str) -> bool:
        """Publish message directly to RabbitMQ"""
        message = Message(
            json.dumps(message_data).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
            priority=priority,
            correlation_id=correlation_id,
            timestamp=datetime.now()
        )
        
        await self.exchange.publish(message, routing_key=routing_key)
        logger.info(f"📤 Published message directly: {routing_key}")
        return True
    
    async def _publish_http(self, routing_key: str, message_data: Dict[str, Any], 
                          priority: int, correlation_id: str) -> bool:
        """Publish message via HTTP to broker service"""
        if not self.http_client:
            await self._init_http_client()
        
        request_data = {
            "routing_key": routing_key,
            "message_data": message_data,
            "priority": priority,
            "correlation_id": correlation_id
        }
        
        response = await self.http_client.post(
            f"{self.config.broker_service_url}/publish",
            json=request_data
        )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"📤 Published message via HTTP: {routing_key}")
            return result.get("success", False)
        else:
            logger.error(f"❌ HTTP publish failed: {response.status_code}")
            return False
    
    async def subscribe_to_messages(self, queue_name: str, callback: Callable):
        """Subscribe to messages (only works with direct RabbitMQ)"""
        if not self.config.use_direct_rabbitmq:
            logger.error("❌ Message subscription requires direct RabbitMQ connection")
            return False
        
        try:
            # Declare queue
            full_queue_name = f"pizza_store.{queue_name}"
            queue = await self.channel.declare_queue(full_queue_name, durable=True)
            
            async def message_handler(message: aio_pika.IncomingMessage):
                async with message.process():
                    try:
                        data = json.loads(message.body.decode())
                        await callback(data)
                        logger.info(f"✅ Processed message from {queue_name}")
                    except Exception as e:
                        logger.error(f"❌ Error processing message: {e}")
                        raise
            
            await queue.consume(message_handler)
            logger.info(f"👂 Subscribed to queue: {queue_name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to subscribe to {queue_name}: {e}")
            return False
    
    async def get_broker_health(self) -> Dict[str, Any]:
        """Get broker service health"""
        try:
            if not self.http_client:
                await self._init_http_client()
            
            response = await self.http_client.get(f"{self.config.broker_service_url}/health")
            if response.status_code == 200:
                return response.json()
            else:
                return {"status": "unhealthy", "error": f"HTTP {response.status_code}"}
                
        except Exception as e:
            logger.error(f"❌ Failed to get broker health: {e}")
            return {"status": "error", "error": str(e)}
    
    async def close(self):
        """Close connections"""
        if self.connection:
            await self.connection.close()
        if self.http_client:
            await self.http_client.aclose()
        logger.info(f"🔌 Broker client closed for {self.config.service_name}")

# Convenience functions for common message types
class MessageTypes:
    """Message type constants"""
    FRAME_DETECTION = "frame.detection"
    VIOLATION_ANALYSIS = "violation.analysis"
    ROI_UPDATE = "roi.update"
    WORKER_TRACKING = "worker.tracking"
    SYSTEM_HEALTH = "system.health"
    VIOLATION_DETECTED = "violation.detected"
    FRAME_PROCESSED = "frame.processed"

async def create_broker_client(service_name: str, use_direct_rabbitmq: bool = False) -> MessageBrokerClient:
    """Create and initialize a broker client"""
    config = BrokerClientConfig(
        service_name=service_name,
        use_direct_rabbitmq=use_direct_rabbitmq
    )
    client = MessageBrokerClient(config)
    await client.initialize()
    return client

# Example usage functions
async def publish_frame_detection(client: MessageBrokerClient, frame_id: str, detections: list):
    """Publish frame detection results"""
    message_data = {
        "frame_id": frame_id,
        "detections": detections,
        "detection_count": len(detections)
    }
    return await client.publish_message(MessageTypes.FRAME_DETECTION, message_data)

async def publish_violation_detected(client: MessageBrokerClient, violation_data: Dict[str, Any]):
    """Publish violation detection"""
    return await client.publish_message(
        MessageTypes.VIOLATION_DETECTED, 
        violation_data, 
        priority=5  # High priority for violations
    )

async def publish_system_health(client: MessageBrokerClient, health_data: Dict[str, Any]):
    """Publish system health status"""
    return await client.publish_message(MessageTypes.SYSTEM_HEALTH, health_data)
