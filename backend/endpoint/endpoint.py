from fastapi import FastAPI, Form, Query
from fastapi.middleware.cors import CORSMiddleware
import asyncpg
import json
import httpx
import asyncio
from typing import Optional, List, Dict, Any
import datetime

# Database connection pool
db_pool = None

registered_user_ids = ['AHT36OPFBZ566CXFL6MA6UU2IQ6A', 'AHH4J4FVYCX5T3H3YQDJCVQK4QNA', 'AHODQRCZS3VYSAT4D45HN6A52LHQ',
                       'AFYBDIE6SF3RXZSC2DASHMMZJGRA', 'AGCRGPW7CDWJJZZY2YVE6QCTOMXQ', 'AEGLDT443U6XGDMB7AU2SJK645HA',
                       'AHCNVSHL3RP3J3BKS52FEAT2EFPQ', 'AGOWD2G7B3LURVZWRKMKIGOW3YPQ', 'AHVWWHZAQ7U46FNQP3BLW22L5R7A',
                       'AHGQKYAYO5JHDAWLQZ7QKX3KKJUQ', 'AGOOLNG7OLKSENEM3RHPXFO7XAAQ', 'AF6VGYGYWE2QEMIMCI5KXVQJ7N6A',
                       'AGDIM6JIATM4UPWDOVTOXR5H6W5Q', 'AGAQIBY2KT7K42ZKWGP2FVGVCUDA', 'AETLU6C2BNDZHNKU2DPIC2KCBGWQ',
                       'AHYXT7RYYGGY5464JYTDSBBXBW7Q', 'AGGRCGWQWMJTOUN5M3B4AFSGRKEA', 'AFZOKI2OHUU7CIDPTMUHNIRBT4OQ',
                       'AGMYTKT5C742DQYR6PGKWU6P4QAQ', 'AFARCGQHJWRPMY56QP2PDPS3YEFA', 'AGB3Q3OVF3VWZJCBCFJQADIIQA4Q',
                       'AEIWLDH4XEHPT5JDHCQ6YAAFHKOQ', 'AEBGNGCGV7TKG6U2CYVWWUCNGZMA', 'AEBANPQXOZL75EBQCTNJMV5BENNA',
                       'AGVRLEJEONW7DDKIBCV62VS2MLZQ', 'AF6GXWA7RCC64DE3LKCY363IPW6Q', 'AGWYPOYY4ZLEUJUECOZLK7DR2QLQ',
                       'AHYOFYA7JEVLTEHLT43I4ZBYLN5A', 'AGNDIKEVVPFYPP3TSLSZXUNTEBPQ', 'AEXQJBYJGBGC73BERYC5LCEANB4Q']

async def init_db_pool():
    """Initialize the database connection pool"""
    global db_pool
    db_pool = await asyncpg.create_pool(
        database="amazon_rating",
        user="resys-user",
        password="hehehe",
        host="localhost",
        port=5432,
        min_size=1,
        max_size=10
    )

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8002",
        "http://127.0.0.1:8001",
        "http://138.2.61.6:3000",
        "http://138.2.61.6:8000",
        "http://138.2.61.6:8001",
        "http://138.2.61.6:20000",
        "http://168.138.42.86:9093"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/endpoint/item_details")
async def get_item_details(item_id: str) -> Optional[Dict[str, Any]]:
    """Fetch item details from database using async streaming query"""
    if not db_pool:
        await init_db_pool()
    
    try:
        async with db_pool.acquire() as conn:
            # Use async query with streaming
            query = "SELECT * FROM oltp.raw_metadata WHERE parent_asin = $1 LIMIT 1"
            row = await conn.fetchrow(query, item_id)
            
            if row:
                # Parse JSON fields safely
                try:
                    num_reviews = json.loads(row[3]) if row[3] else 0
                except (json.JSONDecodeError, TypeError):
                    num_reviews = 0
                
                try:
                    image_data = json.loads(row[7].replace("None", "null")) if row[7] else {}
                    image_large = image_data.get("large", []) if isinstance(image_data, dict) else []
                    image_hires = image_data.get("hi_res", []) if isinstance(image_data, dict) else []
                    image_urls = image_large + image_hires
                    image_urls = [url for url in (image_large + image_hires) if isinstance(url, str)]
                except (json.JSONDecodeError, TypeError):
                    image_urls = []
                
                return {
                    "item_id": item_id,
                    "main_category": row[0],
                    "name": row[1],
                    "rating": row[2],
                    "num_reviews": num_reviews,
                    "price": row[6],
                    "image_urls": image_urls,
                }
            return None
            
    except Exception as error:
        print(f"Database error for item {item_id}: {error}")
        return None

@app.get("/api/endpoint/product_categories")
async def get_product_categories():
    """Fetch product categories from the database"""
    if not db_pool:
        await init_db_pool()
    
    try:
        async with db_pool.acquire() as conn:
            query = "SELECT DISTINCT main_category FROM oltp.raw_metadata"
            rows = await conn.fetch(query)
            categories = [row[0] for row in rows]
            return {"categories": categories}
    except Exception as error:
        print(f"Database error fetching categories: {error}")
        return {"categories": []}

@app.get("/api/endpoint/categories/{category}")
async def get_items_by_category(category: str, page: int = 0, limit: int = 100):
    """Fetch items by category with pagination"""
    if not db_pool:
        await init_db_pool()
    
    try:
        async with db_pool.acquire() as conn:
            # First get the total count for pagination info
            count_query = """
                SELECT COUNT(*) 
                FROM oltp.raw_metadata 
                WHERE main_category = $1
            """
            total_count = await conn.fetchval(count_query, category)
            
            # Then get the paginated items
            query = """
                SELECT parent_asin, main_category, title, average_rating, rating_number, price, images
                FROM oltp.raw_metadata
                WHERE main_category = $1
                ORDER BY average_rating DESC NULLS LAST, rating_number DESC NULLS LAST
                LIMIT $2 OFFSET $3
            """
            offset = page * limit
            rows = await conn.fetch(query, category, limit, offset)

            items = []
            for row in rows:
                try:
                    image_data = json.loads(row[6].replace("None", "null")) if row[6] else {}
                    image_large = image_data.get("large", []) if isinstance(image_data, dict) else []
                    image_hires = image_data.get("hi_res", []) if isinstance(image_data, dict) else []
                    image_urls = [url for url in (image_large + image_hires) if isinstance(url, str)]
                except (json.JSONDecodeError, TypeError):
                    image_urls = []
                
                items.append({
                    "item_id": row[0],
                    "main_category": row[1],
                    "name": row[2],
                    "rating": row[3],
                    "num_reviews": row[4],
                    "price": row[5],
                    "image_urls": image_urls,
                })
            
            return {
                "category": category,
                "items": items,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total_items": total_count,
                    "returned_items": len(items),
                    "has_more": (offset + len(items)) < total_count
                }
            }
    except Exception as error:
        print(f"Database error fetching category {category}: {error}")
        return {"category": category, "items": [], "pagination": {"page": page, "limit": limit, "total_items": 0, "returned_items": 0, "has_more": False}}

@app.on_event("startup")
async def startup_event():
    """Initialize database pool on startup"""
    await init_db_pool()

@app.on_event("shutdown")
async def shutdown_event():
    """Close database pool on shutdown"""
    global db_pool
    if db_pool:
        await db_pool.close()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Recommendation Endpoint Service is running", "status": "healthy"}

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "service": "recommendation_endpoint",
        "database_connected": db_pool is not None
    }


@app.get("/api/endpoint/unified")
async def fetch_item_seq(
    user_id: str | None = None,
    page: int = 0,
    limit: int = 100,
    last_item_id: Optional[List[str]] = Query(None)
):
    """Fetch recommendations using async HTTP and database calls with pagination"""
    try:
        # Default recommendations when no last_item_id list provided
        if not last_item_id:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"http://138.2.61.6:8000/recs/u2i/two_tower_retrieve?user_id={user_id}&count={limit}")
                response.raise_for_status()
                model_data = response.json()
            recommendations = model_data.get("recommendations", [])
        else:
            # Push sequence of last items to feature store
            async with httpx.AsyncClient() as client:
                payload = {
                    "user_id": str(user_id),
                    "new_items": last_item_id,
                    "sequence_length": 10
                }
                post_response = await client.post(
                    "http://138.2.61.6:8000/feature_store/push/item_sequence",
                    json=payload
                )
                print(f"Feature store response status: {post_response.status_code}, body: {post_response.text}")
                # Retrieve recommendations based on pushed sequence
                response = await client.get(f"http://138.2.61.6:8000/recs/u2i/two_tower_retrieve?user_id={user_id}&count={limit}")
                response.raise_for_status()
                model_data = response.json()
            recommendations = model_data.get("recommendations", [])

        # print(recommendations)
        recommendations_ids = recommendations["rec_item_ids"] if "rec_item_ids" in recommendations else []
        scores = recommendations["rec_scores"] if "rec_scores" in recommendations else []

        # Calculate pagination
        start_index = page * limit
        end_index = start_index + limit
        
        # Debug logging
        print(f"Pagination request: user_id={user_id}, page={page}, limit={limit}")
        print(f"Total items available: {len(recommendations_ids)}")
        print(f"Requesting slice: [{start_index}:{end_index}]")
        
        # Get the paginated slice
        paginated_ids = recommendations_ids[start_index:end_index]
        paginated_scores = scores[start_index:end_index]
        
        print(f"Returning {len(paginated_ids)} items for page {page}")
        
        # Fetch item details concurrently using asyncio.gather
        tasks = [get_item_details(item) for item in paginated_ids]
        items = await asyncio.gather(*tasks)
        
        return {
            "user_id": user_id,
            "recommendations": items,
            "score": paginated_scores,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": len(recommendations_ids),
                "has_more": end_index < len(recommendations_ids)
            }
        }
        
    except httpx.HTTPError as e:
        print(f"HTTP error fetching recommendations for user {user_id}: {e}")
        return {
            "user_id": user_id,
            "recommendations": [],
            "score": [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": 0,
                "has_more": False
            }
        }
    except Exception as e:
        print(f"Error fetching recommendations for user {user_id}: {e}")
        return {
            "user_id": user_id,
            "recommendations": [],
            "score": [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": 0,
                "has_more": False
            }
        }

@app.post("/api/endpoint/search")
async def search_items(query: str, page: int = 0, limit: int = 50):
    """Search for items using the title search API and return product details"""
    try:
        if not query.strip():
            return {
                "query": query,
                "recommendations": [],
                "score": [],
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total_items": 0,
                    "has_more": False,
                    "source_type": "search"
                }
            }
        
        print(f"Searching for: '{query}' with limit {limit}")
        
        # Make POST request to the search API
        async with httpx.AsyncClient(timeout=10.0) as client:
            search_response = await client.post(
                f"http://127.0.0.1:8000/search/title?text={query.strip()}&limit={limit}&debug=false"
            )
            search_response.raise_for_status()
            search_data = search_response.json()
        
        print(f"Search API response: {len(search_data.get('items', []))} items found")
        
        # Extract items from search response
        search_items = search_data.get("items", [])
        
        if not search_items:
            return {
                "query": query,
                "recommendations": [],
                "score": [],
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total_items": 0,
                    "has_more": False,
                    "source_type": "search"
                },
                "metadata": search_data.get("metadata", {})
            }
        
        # Calculate pagination
        start_index = page * limit
        end_index = start_index + limit
        
        # Get paginated slice of search results
        paginated_items = search_items[start_index:end_index]
        
        print(f"Processing {len(paginated_items)} items for page {page}")
        
        # Extract parent_asin values and scores
        item_ids = [item.get("parent_asin") for item in paginated_items if item.get("parent_asin")]
        scores = [item.get("score", 1.0) for item in paginated_items]
        
        # Fetch detailed item information from database concurrently
        tasks = [get_item_details(item_id) for item_id in item_ids]
        items_details = await asyncio.gather(*tasks)
        
        # Build response with valid items
        recommendations = []
        valid_scores = []
        
        for i, item_detail in enumerate(items_details):
            if item_detail is not None:
                recommendations.append(item_detail)
                valid_scores.append(scores[i] if i < len(scores) else 1.0)
        
        print(f"Returning {len(recommendations)} items with database details")
        
        return {
            "query": query,
            "recommendations": recommendations,
            "score": valid_scores,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": len(search_items),
                "has_more": end_index < len(search_items),
                "source_type": "search"
            },
            "metadata": search_data.get("metadata", {})
        }
        
    except httpx.HTTPError as e:
        print(f"HTTP error in search for query '{query}': {e}")
        return {
            "query": query,
            "recommendations": [],
            "score": [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": 0,
                "has_more": False,
                "source_type": "error"
            },
            "error": f"Search API error: {str(e)}"
        }
    except Exception as e:
        print(f"Error in search for query '{query}': {e}")
        return {
            "query": query,
            "recommendations": [],
            "score": [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": 0,
                "has_more": False,
                "source_type": "error"
            },
            "error": f"Server error: {str(e)}"
        }

KAFKA_BOOTSTRAP_SERVERS = ['168.138.42.86:9093']
KAFKA_TOPIC_ANALYTICS = 'user_analytics_topic'
kafka_producer = None

def initialize_kafka_producer():
    global kafka_producer 
    
    try:
        from kafka import KafkaProducer
        from kafka.errors import NoBrokersAvailable, KafkaTimeoutError

        # Try to create the producer
        producer_config = {
            'bootstrap_servers': KAFKA_BOOTSTRAP_SERVERS,
            'value_serializer': lambda v: json.dumps(v).encode('utf-8'),
            'retries': 3,
            'linger_ms': 100,
            'request_timeout_ms': 15000, 
            'acks': 'all' 
        }
        kafka_producer = KafkaProducer(**producer_config) # Assign to global
        
        # If successful
        print("Kafka Producer initialized successfully.")

    except ImportError:
        print("`kafka-python` library not found. Analytics will only be logged locally.")
        kafka_producer = None
    except NoBrokersAvailable:
        print(f"Kafka connection failed: No brokers available at {KAFKA_BOOTSTRAP_SERVERS}. Analytics will only be logged locally.")
        kafka_producer = None 
    except Exception as e:
        print(f"Error initializing Kafka Producer: {e}. Analytics will only be logged locally.")
        kafka_producer = None

initialize_kafka_producer()

@app.post("/analytics/events")
def log_analytic_event(
    user_id: str = Form(...), 
    event_type: str = Form(...), 
    item_id: Optional[str] = Form(None), 
    extra_data: Optional[str] = Form(None)
):
    """Logs an analytics event to session state and sends to Kafka if enabled."""
    timestamp = datetime.datetime.now()
    print(f"Logging event: {event_type} for user {user_id} at {timestamp.isoformat()}")
    # Parse extra_data if provided
    parsed_extra_data = None
    if extra_data:
        try:
            parsed_extra_data = json.loads(extra_data)
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse extra_data: {extra_data}")

    event = {
        "timestamp": timestamp.isoformat(),
        "user_id": user_id,
        "event_type": event_type,
        "item_id": item_id,
        "extra_data": parsed_extra_data
    }
    # print(f"Local Analytics Event: {event}")

    # Use the global kafka_producer variable
    if kafka_producer: 
        try:
            from kafka.errors import KafkaTimeoutError # Import here if not already global
            future = kafka_producer.send(KAFKA_TOPIC_ANALYTICS, value=event, key=user_id.encode('utf-8'))
            metadata = future.get(timeout=10) 
            print(f"Successfully sent event to Kafka. Topic: {metadata.topic}, Partition: {metadata.partition}, Offset: {metadata.offset}")
        except KafkaTimeoutError as kte: 
            print(f"Kafka send timeout for event '{event_type}': {kte}")
        except Exception as e: 
            print(f"Error sending event '{event_type}' to Kafka: {e}")
    
    return {"status": "success", "message": "Event logged successfully"}

@app.get("/api/debug")
async def debug_endpoint(user_id: Optional[str] = None):
    try:
        # Use async HTTP client for non-blocking requests
        async with httpx.AsyncClient() as client:
            response = await client.get(f"http://138.2.61.6:8000/feature_store/fetch/item_sequence?user_id={user_id}")
            response.raise_for_status()
            model_data = response.json()
            return model_data
    except httpx.HTTPError as e:
        print(f"HTTP error fetching debug data for user {user_id}: {e}")
        return {"error": str(e), "status": "failed"}
    except Exception as e:
        print(f"Error fetching debug data for user {user_id}: {e}")
        return {"error": str(e), "status": "failed"}