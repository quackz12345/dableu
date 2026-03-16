import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

function App() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const [schema, setSchema] = useState([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState("");

  const [question, setQuestion] = useState("");
  const [runningQuery, setRunningQuery] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [queryResult, setQueryResult] = useState(null);

  const loadTables = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/tables`);
      const data = await res.json();

      const tableList = data.tables || [];
      setTables(tableList);

      if (tableList.length > 0 && !selectedTable) {
        setSelectedTable(tableList[0]);
      }

      if (selectedTable && !tableList.includes(selectedTable)) {
        setSelectedTable(tableList[0] || null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load datasets.");
    } finally {
      setLoading(false);
    }
  };

  const loadSchema = async (tableName) => {
    if (!tableName) {
      setSchema([]);
      return;
    }

    try {
      setSchemaLoading(true);
      setSchemaError("");

      const res = await fetch(`${API_BASE}/schema/${tableName}`);
      const data = await res.json();

      if (data.error) {
        setSchemaError(data.error);
        setSchema([]);
        return;
      }

      setSchema(data.columns || []);
    } catch (err) {
      console.error(err);
      setSchemaError("Failed to load schema.");
      setSchema([]);
    } finally {
      setSchemaLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    loadSchema(selectedTable);
    setQueryResult(null);
    setQueryError("");
  }, [selectedTable]);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!uploadFile) {
      setUploadMessage("Please choose a CSV file first.");
      return;
    }

    try {
      setUploading(true);
      setUploadMessage("");

      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch(`${API_BASE}/upload_csv/`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        setUploadMessage(`Upload failed: ${data.error}`);
        return;
      }

      setUploadMessage(`Uploaded as table: ${data.table_name}`);
      setSelectedTable(data.table_name);
      setUploadFile(null);

      await loadTables();
      await loadSchema(data.table_name);
    } catch (err) {
      console.error(err);
      setUploadMessage("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleRunQuery = async (e) => {
    e.preventDefault();

    if (!selectedTable) {
      setQueryError("Please select a dataset.");
      return;
    }

    if (!question.trim()) {
      setQueryError("Please enter a question.");
      return;
    }

    try {
      setRunningQuery(true);
      setQueryError("");
      setQueryResult(null);

      const formData = new FormData();
      formData.append("table_name", selectedTable);
      formData.append("question", question);
      formData.append("preview_rows", "20");

      const res = await fetch(`${API_BASE}/materialize_query/`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        setQueryError(data.error);
        return;
      }

      setQueryResult(data);
      await loadTables();
    } catch (err) {
      console.error(err);
      setQueryError("Failed to run query.");
    } finally {
      setRunningQuery(false);
    }
  };

  const renderResultsTable = () => {
    if (!queryResult || !queryResult.results || queryResult.results.length === 0) {
      return <p>No preview rows returned.</p>;
    }

    const columns = Object.keys(queryResult.results[0]);

    return (
      <div className="results-table-wrapper">
        <table className="results-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queryResult.results.map((row, index) => (
              <tr key={index}>
                {columns.map((col) => (
                  <td key={col}>{String(row[col] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="title">SQLinAItor</h1>
        <p className="subtitle">Upload, query, validate, export</p>

        <div className="panel">
          <h2>Upload CSV</h2>
          <form onSubmit={handleUpload} className="upload-form">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setUploadFile(e.target.files[0] || null)}
            />
            <button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>

          {uploadMessage && <p className="status">{uploadMessage}</p>}
        </div>

        <div className="panel">
          <h2>Datasets</h2>

          {loading && <p>Loading datasets...</p>}
          {error && <p className="error">{error}</p>}

          {!loading && !error && tables.length === 0 && (
            <p>No datasets found.</p>
          )}

          <ul className="dataset-list">
            {tables.map((table) => (
              <li key={table}>
                <button
                  className={`dataset-button ${
                    selectedTable === table ? "active" : ""
                  }`}
                  onClick={() => setSelectedTable(table)}
                >
                  {table}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="main">
        <div className="panel">
          <h2>Selected Dataset</h2>
          <p>{selectedTable || "None selected"}</p>
        </div>

        <div className="panel">
          <h2>Schema</h2>

          {!selectedTable && <p>Select a dataset to view schema.</p>}
          {schemaLoading && <p>Loading schema...</p>}
          {schemaError && <p className="error">{schemaError}</p>}

          {!schemaLoading && !schemaError && schema.length > 0 && (
            <table className="schema-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {schema.map((col) => (
                  <tr key={col.column_name}>
                    <td>{col.column_name}</td>
                    <td>{col.column_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2>Ask a Question</h2>
          <form onSubmit={handleRunQuery} className="query-form">
            <textarea
              className="query-input"
              placeholder="Example: show the 10 most profitable trades"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
            />
            <button type="submit" disabled={runningQuery}>
              {runningQuery ? "Running..." : "Run Query"}
            </button>
          </form>

          {queryError && <p className="error">{queryError}</p>}
        </div>

        <div className="panel">
          <h2>Query Result</h2>

          {!queryResult && <p>No query run yet.</p>}

          {queryResult && (
            <>
              <p>
                <strong>Result table:</strong> {queryResult.result_table}
              </p>
              <p>
                <strong>Rows:</strong> {queryResult.row_count}
              </p>

              <div className="sql-box">
                <strong>Generated SQL</strong>
                <pre>{queryResult.sql}</pre>
              </div>

              <div className="download-row">
                <a
                  className="download-button"
                  href={`${API_BASE}/download/${queryResult.result_table}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download CSV
                </a>
              </div>

              {renderResultsTable()}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;