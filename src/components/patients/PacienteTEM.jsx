import React, { useState, useMemo, useEffect } from "react";
import "./PacienteTEM.css";

const PacienteTEM = ({ sessions, onViewSession }) => {
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const clearFilters = () => {
    setFilterStatus("Todos");
    setCurrentPage(1);
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterStatus !== "Todos") {
        if (filterStatus === "completed" && s.status !== "completed") return false;
        if (filterStatus === "in_progress" && s.status !== "in_progress") return false;
        if (filterStatus === "calibrating" && s.status !== "calibrating") return false;
      }
      return true;
    });
  }, [sessions, filterStatus]);

  const totalPages = Math.ceil(filteredSessions.length / pageSize);
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (status) => {
    switch (status) {
      case "completed":
        return <span className="badge bg-success">Completada</span>;
      case "in_progress":
        return <span className="badge bg-warning">En progreso</span>;
      case "calibrating":
        return <span className="badge bg-info">Calibrando</span>;
      default:
        return <span className="badge bg-secondary">{status || "—"}</span>;
    }
  };

  return (
    <div className="tem-patient-page">
      <div className="tem-sessions-container">
        {/* --- FILTROS --- */}
        <div className="filters-box flex-wrap align-items-center">
          <div className="filter-group">
            <label>Estado:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="Todos">Todos</option>
              <option value="completed">Completada</option>
              <option value="in_progress">En progreso</option>
              <option value="calibrating">Calibrando</option>
            </select>
          </div>

          <button
            className="btn btn-outline-danger mt-2 mt-md-0"
            onClick={clearFilters}
            style={{ whiteSpace: "nowrap", minWidth: "110px" }}
          >
            Limpiar ✖
          </button>
        </div>

        {/* --- TABLA --- */}
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>ID Sesión</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Nivel</th>
                <th>Estímulos</th>
                <th>Puntaje</th>
                <th className="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    No hay sesiones TEM con esos filtros.
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((s) => (
                  <tr key={s.id}>
                    <td title={s.id}>{s.id.substring(0, 10)}...</td>
                    <td>{formatDate(s.startedAt)}</td>
                    <td>{statusBadge(s.status)}</td>
                    <td>{s.nivel ?? "—"}</td>
                    <td>
                      {s.completedStimuli?.length ?? 0} / {s.estimulosSecuencia?.length ?? "—"}
                    </td>
                    <td>
                      {s.temPorcentaje != null
                        ? `${s.temPorcentaje}%`
                        : "—"}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn-outline-secondary"
                        onClick={() => onViewSession(s)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- PAGINACIÓN --- */}
        {totalPages > 1 && (
          <div className="pagination-wrapper">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  className={page === currentPage ? "active" : ""}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              )
            )}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PacienteTEM;
