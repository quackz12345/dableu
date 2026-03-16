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

  useEffect(() => {
    loadTables();
  }, []);

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
    } catch (err) {
      console.error(err);
      setUploadMessage("Upload failed.");
    } finally {
      setUploading(false);
    }
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
          <h2>Next Step</h2>
          <p>Next we’ll show the schema for the selected dataset.</p>
        </div>
      </main>
    </div>
  );
}

export default App;