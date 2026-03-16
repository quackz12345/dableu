import os
from google import genai
import re

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def clean_sql(text: str) -> str:
    text = text.strip()

    # remove markdown code blocks
    text = re.sub(r"```sql", "", text, flags=re.IGNORECASE)
    text = text.replace("```", "")

    # remove leading/trailing whitespace
    text = text.strip()

    # remove trailing semicolon if present
    if text.endswith(";"):
        text = text[:-1]

    return text

def generate_sql(question: str, table_name: str, columns: list[dict]) -> str:
    schema_lines = []
    for col in columns:
        schema_lines.append(f"{col['column_name']} {col['column_type']}")

    schema_text = ", ".join(schema_lines)

    prompt = f"""
You are translating natural language into DuckDB SQL.

Rules:
- Return ONLY SQL
- Use only the table and columns provided
- Do not invent columns
- The table name is: {table_name}

Schema:
{table_name}({schema_text})

User question:
{question}
"""

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )
    sql = response.text
    return clean_sql(sql)