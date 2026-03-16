import os
import time
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def clean_sql(text: str) -> str:
    text = text.strip()
    text = text.replace("```sql", "").replace("```", "").strip()
    return text

def generate_sql(question: str, table_name: str, columns: list[dict]) -> str:
    schema_lines = [f"{col['column_name']} {col['column_type']}" for col in columns]
    schema_text = ", ".join(schema_lines)

    prompt = f"""
You translate natural language into DuckDB SQL.

Rules:
- Return only SQL
- Use only the provided table and columns
- Do not invent columns
- The query should read from this table: {table_name}
- Prefer simple valid DuckDB SQL

Schema:
{table_name}({schema_text})

User question:
{question}
"""

    last_error = None

    for _ in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=prompt
            )
            return clean_sql(response.text)
        except Exception as e:
            last_error = e
            time.sleep(2)

    raise last_error