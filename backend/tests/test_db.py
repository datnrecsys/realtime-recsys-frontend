import psycopg
from typing import Optional, List, Any

# Database connection parameters
DB_PARAMS = {
    "dbname": "amazon_rating",
    "user": "resys-user",
    "password": "hehehe",
    "host": "localhost",
    "port": 5432,
}

def get_user_ids() -> Optional[List[Any]]:
    """Fetch all distinct user_ids from database using psycopg"""
    try:
        with psycopg.connect(**DB_PARAMS) as conn:
            with conn.cursor() as cur:
                query = "SELECT DISTINCT user_id FROM experimental.amz_rating LIMIT 30"
                cur.execute(query)
                rows = cur.fetchall()
                if rows:
                    return [row[0] for row in rows]
                return []
    except Exception as error:
        print(error)
        return None

print(get_user_ids())
