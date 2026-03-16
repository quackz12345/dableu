import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

function App() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/tables`)
      .then((res) => res.json())
      .then((data) => {
        setTables(data.tables || []);
        if (data.tables && data.tables.length > 0) {
          setSelectedTable(data.tables[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load datasets.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="title">AI SQL Explorer</h1>
        <p className="subtitle">Upload, query, validate, export</p>

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
          <p>
            Next we’ll add schema preview, upload, and the natural language query
            box.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;