#!/usr/bin/env python3
"""
Kafka Message Broker - Pizza Store Violation Detection System
Handles inter-service communication via Apache Kafka
"""

import os
import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, Callable, List
from dataclasses import dataclass

try:
    from kafka import KafkaProducer, KafkaConsumer
    from kafka.errors import KafkaError
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    logging.warning("Kafka library not available. Using mock implementation.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class KafkaConfig:
    """Kafka configuration"""
    bootstrap_servers: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    client_id: str = os.getenv("KAFKA_CLIENT_ID", "pizza_store_detection")
    
    # Topics
    frame_topic: str = os.getenv("KAFKA_FRAME_TOPIC", "video_frames")
    detection_topic: str = os.getenv("KAFKA_DETECTION_TOPIC", "object_detections")
    violation_topic: str = os.getenv("KAFKA_VIOLATION_TOPIC", "violations")
    alert_topic: str = os.getenv("KAFKA_ALERT_TOPIC", "alerts")
    
    # Producer settings
    producer_batch_size: int = int(os.getenv("KAFKA_BATCH_SIZE", "16384"))
    producer_linger_ms: int = int(os.getenv("KAFKA_LINGER_MS", "10"))
    producer_compression_type: str = os.getenv("KAFKA_COMPRESSION", "gzip")
    
    # Consumer settings
    consumer_group_id: str = os.getenv("KAFKA_CONSUMER_GROUP", "pizza_store_consumers")
    consumer_auto_offset_reset: str = os.getenv("KAFKA_AUTO_OFFSET_RESET", "latest")
    consumer_enable_auto_commit: bool = os.getenv("KAFKA_AUTO_COMMIT", "true").lower() == "true"

class KafkaMessageBroker:
    """Advanced Kafka message broker for microservices communication"""
    
    def __init__(self, config: KafkaConfig):
        self.config = config
        self.producer = None
        self.consumers = {}
        self.is_connected = False
        self.message_handlers = {}
        
        if KAFKA_AVAILABLE:
            self._initialize_producer()
        else:
            logger.warning("Kafka not available. Using mock implementation.")
    
    def _initialize_producer(self):
        """Initialize Kafka producer"""
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=self.config.bootstrap_servers,
                client_id=self.config.client_id,
                batch_size=self.config.producer_batch_size,
                linger_ms=self.config.producer_linger_ms,
                compression_type=self.config.producer_compression_type,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None
            )
            self.is_connected = True
            logger.info("Kafka producer initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Kafka producer: {e}")
            self.is_connected = False
    
    async def publish_frame(self, frame_data: Dict[str, Any]) -> bool:
        """Publish video frame to Kafka"""
        return await self._publish_message(
            topic=self.config.frame_topic,
            key=frame_data.get("frame_id"),
            value=frame_data
        )
    
    async def publish_detection(self, detection_data: Dict[str, Any]) -> bool:
        """Publish detection results to Kafka"""
        return await self._publish_message(
            topic=self.config.detection_topic,
            key=detection_data.get("frame_id"),
            value=detection_data
        )
    
    async def publish_violation(self, violation_data: Dict[str, Any]) -> bool:
        """Publish violation event to Kafka"""
        return await self._publish_message(
            topic=self.config.violation_topic,
            key=violation_data.get("violation_id"),
            value=violation_data
        )
    
    async def publish_alert(self, alert_data: Dict[str, Any]) -> bool:
        """Publish alert to Kafka"""
        return await self._publish_message(
            topic=self.config.alert_topic,
            key=alert_data.get("alert_id"),
            value=alert_data
        )
    
    async def _publish_message(self, topic: str, key: Optional[str], value: Dict[str, Any]) -> bool:
        """Generic message publishing"""
        if not KAFKA_AVAILABLE or not self.is_connected:
            logger.debug(f"Mock publish to {topic}: {key}")
            return True
        
        try:
            # Add metadata
            message = {
                **value,
                "published_at": datetime.now().isoformat(),
                "publisher": self.config.client_id
            }
            
            future = self.producer.send(topic, key=key, value=message)
            record_metadata = future.get(timeout=10)
            
            logger.debug(f"Message published to {topic} partition {record_metadata.partition} offset {record_metadata.offset}")
            return True
            
        except KafkaError as e:
            logger.error(f"Failed to publish message to {topic}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error publishing to {topic}: {e}")
            return False
    
    def subscribe_to_frames(self, handler: Callable[[Dict[str, Any]], None]):
        """Subscribe to video frames"""
        self._subscribe_to_topic(self.config.frame_topic, handler)
    
    def subscribe_to_detections(self, handler: Callable[[Dict[str, Any]], None]):
        """Subscribe to detection results"""
        self._subscribe_to_topic(self.config.detection_topic, handler)
    
    def subscribe_to_violations(self, handler: Callable[[Dict[str, Any]], None]):
        """Subscribe to violation events"""
        self._subscribe_to_topic(self.config.violation_topic, handler)
    
    def subscribe_to_alerts(self, handler: Callable[[Dict[str, Any]], None]):
        """Subscribe to alerts"""
        self._subscribe_to_topic(self.config.alert_topic, handler)
    
    def _subscribe_to_topic(self, topic: str, handler: Callable[[Dict[str, Any]], None]):
        """Generic topic subscription"""
        if not KAFKA_AVAILABLE:
            logger.warning(f"Mock subscription to {topic}")
            return
        
        try:
            consumer = KafkaConsumer(
                topic,
                bootstrap_servers=self.config.bootstrap_servers,
                group_id=self.config.consumer_group_id,
                auto_offset_reset=self.config.consumer_auto_offset_reset,
                enable_auto_commit=self.config.consumer_enable_auto_commit,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                key_deserializer=lambda k: k.decode('utf-8') if k else None
            )
            
            self.consumers[topic] = consumer
            self.message_handlers[topic] = handler
            
            # Start consumer in background
            asyncio.create_task(self._consume_messages(topic))
            
            logger.info(f"Subscribed to topic: {topic}")
            
        except Exception as e:
            logger.error(f"Failed to subscribe to {topic}: {e}")
    
    async def _consume_messages(self, topic: str):
        """Consume messages from a topic"""
        consumer = self.consumers[topic]
        handler = self.message_handlers[topic]
        
        try:
            for message in consumer:
                try:
                    # Process message
                    await self._process_message(message.value, handler)
                    
                except Exception as e:
                    logger.error(f"Error processing message from {topic}: {e}")
                    
        except Exception as e:
            logger.error(f"Error consuming from {topic}: {e}")
    
    async def _process_message(self, message_data: Dict[str, Any], handler: Callable):
        """Process a single message"""
        try:
            if asyncio.iscoroutinefunction(handler):
                await handler(message_data)
            else:
                handler(message_data)
        except Exception as e:
            logger.error(f"Error in message handler: {e}")
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get broker health status"""
        return {
            "kafka_available": KAFKA_AVAILABLE,
            "is_connected": self.is_connected,
            "active_consumers": len(self.consumers),
            "topics": {
                "frames": self.config.frame_topic,
                "detections": self.config.detection_topic,
                "violations": self.config.violation_topic,
                "alerts": self.config.alert_topic
            },
            "config": {
                "bootstrap_servers": self.config.bootstrap_servers,
                "client_id": self.config.client_id,
                "consumer_group": self.config.consumer_group_id
            }
        }
    
    def close(self):
        """Close all connections"""
        try:
            if self.producer:
                self.producer.close()
            
            for consumer in self.consumers.values():
                consumer.close()
            
            logger.info("Kafka connections closed")
            
        except Exception as e:
            logger.error(f"Error closing Kafka connections: {e}")

class MockMessageBroker:
    """Mock message broker for testing without Kafka"""
    
    def __init__(self):
        self.published_messages = []
        self.subscribers = {}
        logger.info("Mock message broker initialized")
    
    async def publish_frame(self, frame_data: Dict[str, Any]) -> bool:
        return await self._mock_publish("frames", frame_data)
    
    async def publish_detection(self, detection_data: Dict[str, Any]) -> bool:
        return await self._mock_publish("detections", detection_data)
    
    async def publish_violation(self, violation_data: Dict[str, Any]) -> bool:
        return await self._mock_publish("violations", violation_data)
    
    async def publish_alert(self, alert_data: Dict[str, Any]) -> bool:
        return await self._mock_publish("alerts", alert_data)
    
    async def _mock_publish(self, topic: str, data: Dict[str, Any]) -> bool:
        message = {
            "topic": topic,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        self.published_messages.append(message)
        
        # Notify subscribers
        if topic in self.subscribers:
            for handler in self.subscribers[topic]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    logger.error(f"Error in mock handler for {topic}: {e}")
        
        logger.debug(f"Mock published to {topic}")
        return True
    
    def subscribe_to_frames(self, handler: Callable):
        self._mock_subscribe("frames", handler)
    
    def subscribe_to_detections(self, handler: Callable):
        self._mock_subscribe("detections", handler)
    
    def subscribe_to_violations(self, handler: Callable):
        self._mock_subscribe("violations", handler)
    
    def subscribe_to_alerts(self, handler: Callable):
        self._mock_subscribe("alerts", handler)
    
    def _mock_subscribe(self, topic: str, handler: Callable):
        if topic not in self.subscribers:
            self.subscribers[topic] = []
        self.subscribers[topic].append(handler)
        logger.info(f"Mock subscribed to {topic}")
    
    def get_health_status(self) -> Dict[str, Any]:
        return {
            "kafka_available": False,
            "is_connected": True,
            "mock_mode": True,
            "published_messages": len(self.published_messages),
            "active_subscribers": {topic: len(handlers) for topic, handlers in self.subscribers.items()}
        }
    
    def close(self):
        logger.info("Mock broker closed")

# Factory function
def create_message_broker(config: Optional[KafkaConfig] = None) -> KafkaMessageBroker:
    """Create message broker instance"""
    if config is None:
        config = KafkaConfig()
    
    if KAFKA_AVAILABLE:
        return KafkaMessageBroker(config)
    else:
        return MockMessageBroker()

# Global instance
message_broker = create_message_broker()
