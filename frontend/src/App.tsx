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
      <header className="app__header">
        <Link to="/runs" className="app__brand">
          GA Control Plane
        </Link>
        <nav className="app__nav">
          <Link to="/runs">Runs</Link>
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
