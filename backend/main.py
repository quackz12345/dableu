from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
import os
import re
import shutil
import traceback
from .database import conn
from .ai_sql import generate_sql
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "data/uploads"
EXPORT_FOLDER = "data/exports"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXPORT_FOLDER, exist_ok=True)


def sanitize_table_name(name: str) -> str:
    base = os.path.splitext(name)[0].lower()
    base = base.replace("-", "_neg_")
    base = re.sub(r"[^a-zA-Z0-9_]", "_", base)

    if not re.match(r"^[a-zA-Z_]", base):
        base = f"t_{base}"

    return base


def get_table_columns(table_name: str) -> list[dict]:
    rows = conn.execute(f"DESCRIBE {table_name}").fetchall()
    return [{"column_name": row[0], "column_type": row[1]} for row in rows]


def serialize_rows(result_rows, result_columns):
    formatted_rows = []
    for row in result_rows:
        row_dict = {}
        for col_name, value in zip(result_columns, row):
            if hasattr(value, "isoformat"):
                row_dict[col_name] = value.isoformat()
            else:
                row_dict[col_name] = value
        formatted_rows.append(row_dict)
    return formatted_rows


def next_result_table_name(source_table: str) -> str:
    safe_source = sanitize_table_name(source_table)
    prefix = f"result_{safe_source}_"

    existing = conn.execute("SHOW TABLES").fetchall()
    existing_names = {row[0] for row in existing}

    i = 1
    while f"{prefix}{i}" in existing_names:
        i += 1

    return f"{prefix}{i}"


@app.get("/")
async def home():
    return {"message": "AI SQL backend is running"}


@app.post("/upload_csv/")
async def upload_csv(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        table_name = sanitize_table_name(file.filename)
        abs_path = os.path.abspath(file_path).replace("\\", "/")

        conn.execute(f"DROP TABLE IF EXISTS {table_name}")
        conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM '{abs_path}'")

        columns = get_table_columns(table_name)

        return {
            "message": f"Loaded CSV into table '{table_name}'",
            "table_name": table_name,
            "columns": columns
        }

    except Exception as e:
        print(traceback.format_exc())
        return {"error": str(e)}


@app.get("/tables")
async def list_tables():
    try:
        rows = conn.execute("SHOW TABLES").fetchall()
        tables = [row[0] for row in rows]
        return {"tables": tables}
    except Exception as e:
        print(traceback.format_exc())
        return {"error": str(e)}


@app.get("/schema/{table_name}")
async def get_schema(table_name: str):
    try:
        columns = get_table_columns(table_name)
        return {"table_name": table_name, "columns": columns}
    except Exception as e:
        print(traceback.format_exc())
        return {"error": str(e)}


@app.post("/generate_sql/")
async def generate_sql_endpoint(
    table_name: str = Form(...),
    question: str = Form(...)
):
    try:
        columns = get_table_columns(table_name)
        sql = generate_sql(question, table_name, columns)

        return {
            "table_name": table_name,
            "question": question,
            "sql": sql
        }

    except Exception as e:
        print(traceback.format_exc())
        return {"error": str(e)}


@app.post("/query/")
async def query_table(
    table_name: str = Form(...),
    question: str = Form(...),
    preview_rows: int = Form(20)
):
    try:
        columns = get_table_columns(table_name)
        sql = generate_sql(question, table_name, columns)

        result = conn.execute(sql).fetchall()
        result_columns = [desc[0] for desc in conn.description]

        formatted_rows = serialize_rows(result[:preview_rows], result_columns)

        return {
            "table_name": table_name,
            "question": question,
            "sql": sql,
            "row_count": len(result),
            "preview_count": len(formatted_rows),
            "results": formatted_rows
        }

    except Exception as e:
        print(traceback.format_exc())
        return {"error": str(e)}


@app.post("/materialize_query/")
async def materialize_query(
    table_name: str = Form(...),
    question: str = Form(...),
    preview_rows: int = Form(20)
):
    try:
        columns = get_table_columns(table_name)
        sql = generate_sql(question, table_name, columns)

        result_table = next_result_table_name(table_name)

        conn.execute(f"CREATE TABLE {result_table} AS {sql}")

        preview = conn.execute(
            f"SELECT * FROM {result_table} LIMIT {preview_rows}"
        ).fetchall()
        preview_columns = [desc[0] for desc in conn.description]
        formatted_rows = serialize_rows(preview, preview_columns)

        total_count = conn.execute(
            f"SELECT COUNT(*) FROM {result_table}"
        ).fetchone()[0]

        return {
            "source_table": table_name,
            "result_table": result_table,
            "question": question,
            "sql": sql,
            "row_count": total_count,
            "preview_count": len(formatted_rows),
            "results": formatted_rows
        }

    except Exception as e:
        print(traceback.format_exc())
        return {"error": str(e)}


@app.get("/preview/{table_name}")
async def preview_table(table_name: str, limit: int = 20):
    try:
        rows = conn.execute(f"SELECT * FROM {table_name} LIMIT {limit}").fetchall()
        columns = [desc[0] for desc in conn.description]
        formatted_rows = serialize_rows(rows, columns)

        total_count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]

        return {
            "table_name": table_name,
            "row_count": total_count,
            "preview_count": len(formatted_rows),
            "results": formatted_rows
        }

    except Exception as e:
        print(traceback.format_exc())
        return {"error": str(e)}


@app.get("/download/{table_name}")
async def download_table(table_name: str):
    try:
        safe_name = sanitize_table_name(table_name)
        export_path = os.path.abspath(
            os.path.join(EXPORT_FOLDER, f"{safe_name}.csv")
        ).replace("\\", "/")

        conn.execute(
            f"COPY (SELECT * FROM {table_name}) TO '{export_path}' (HEADER, DELIMITER ',')"
        )

        return FileResponse(
            path=export_path,
            media_type="text/csv",
            filename=f"{safe_name}.csv"
        )

    except Exception as e:
        print(traceback.format_exc())
        return {"error": str(e)}