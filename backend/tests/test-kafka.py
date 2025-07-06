import kafka
import json
import time

def test_kafka_production():
    print("=== Kafka Production Test ===")
    
    # Create consumer first
    consumer = kafka.KafkaConsumer(
        group_id='test', 
        bootstrap_servers=['168.138.42.86:9092'],
        auto_offset_reset='latest'
    )
    
    topics = list(consumer.topics())
    print(f"Available topics: {topics}")
    
    if 'user_analytics_topic' not in topics:
        print("Topic not found!")
        return
    
    # Create producer with detailed config
    producer = kafka.KafkaProducer(
        bootstrap_servers=['168.138.42.86:9093'],
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        acks='all',
        retries=3,
        request_timeout_ms=30000,
        delivery_timeout_ms=60000
    )
    
    # Check if we can access topic metadata
    try:
        metadata = producer.partitions_for('user_analytics_topic')
        print(f"Topic partitions: {metadata}")
    except Exception as e:
        print(f"Cannot access topic metadata: {e}")
        return
    
    # Subscribe consumer to see our messages
    consumer.subscribe(['user_analytics_topic'])
    
    # Test message
    test_msg = {"event": "test", "user": "test_user", "timestamp": time.time()}
    
    try:
        print("Sending test message...")
        future = producer.send('user_analytics_topic', test_msg)
        record_metadata = future.get(timeout=30)
        print(f"Message sent successfully!")
        print(f"Partition: {record_metadata.partition}, Offset: {record_metadata.offset}")
        
        # Try to consume the message we just sent
        print("Checking if message was received...")
        consumer.poll(timeout_ms=1000)
        for message in consumer:
            print(f"Received: {message.value}")
            break
            
    except Exception as e:
        print(f"Failed to send message: {e}")
    finally:
        producer.close()
        consumer.close()

if __name__ == "__main__":
    test_kafka_production()