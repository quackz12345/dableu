import duckdb
import os

DATA_DIR = "data"
DB_PATH = os.path.join(DATA_DIR, "database.duckdb")

os.makedirs(DATA_DIR, exist_ok=True)

conn = duckdb.connect(DB_PATH)