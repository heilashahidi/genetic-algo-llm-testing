import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RunsListPage } from "./pages/RunsListPage";
import { NewRunPage } from "./pages/NewRunPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { SchemaEditorPage } from "./pages/SchemaEditorPage";

export function App() {
  const location = useLocation();
  const onNewRun = location.pathname === "/runs/new";
  // The run-detail page hosts the lineage tree, which needs the full viewport
  // width to show long lineages; other pages stay at a readable width.
  const onRunDetail =
    location.pathname.startsWith("/runs/") && location.pathname !== "/runs/new";

  return (
    <div className="app">
      <div className="dot-grid" aria-hidden />
      <header className="app__header">
        <Link to="/runs" className="app__brand">
          <span className="app__brand-mark" aria-hidden>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <g stroke="#0b0b0d" strokeWidth="0.5" strokeLinejoin="round">
                <path d="M12 3 L19 7 L12 11 L5 7 Z" fill="#ffffff" fillOpacity="0.95" />
                <path d="M5 7 L12 11 L12 19.5 L5 15.5 Z" fill="#ffffff" fillOpacity="0.42" />
                <path d="M19 7 L12 11 L12 19.5 L19 15.5 Z" fill="#ffffff" fillOpacity="0.24" />
              </g>
            </svg>
          </span>
          <span>
            <span className="app__brand-sub">genetic · llm robustness</span>
            GA Control Plane
          </span>
        </Link>
        <nav className="app__nav">
          <Link
            to="/runs"
            className={location.pathname.startsWith("/runs") ? "is-active" : ""}
          >
            Runs
          </Link>
          <Link
            to="/schema"
            className={location.pathname === "/schema" ? "is-active" : ""}
          >
            Genome
          </Link>
          <Link
            to="/runs/new"
            className={`btn btn--primary ${onNewRun ? "is-active" : ""}`}
          >
            New run
          </Link>
        </nav>
      </header>
      <main className={`app__main ${onRunDetail ? "app__main--wide" : ""}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/runs" replace />} />
          <Route path="/runs" element={<RunsListPage />} />
          <Route path="/runs/new" element={<NewRunPage />} />
          <Route path="/schema" element={<SchemaEditorPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="*" element={<Navigate to="/runs" replace />} />
        </Routes>
      </main>
    </div>
  );
}
