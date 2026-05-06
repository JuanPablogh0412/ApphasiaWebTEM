import React, { useState, useMemo, useEffect } from "react";
import TEMAssignedStimuli from "./TEMAssignedStimuli";
import TEMAssignModal from "./TEMAssignModal";
import { updatePatient } from "../../services/patientService";
import "./PacienteTEM.css";

const PacienteTEM = ({ sessions, onViewSession, pacienteId, patientInfo, onNivelChanged }) => {
  const [subTab, setSubTab] = useState("sesiones");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Nivel TEM editable
  const [editingNivel, setEditingNivel] = useState(false);
  const [nivelDraft, setNivelDraft] = useState(patientInfo?.nivel_actual ?? 1);
  const [savingNivel, setSavingNivel] = useState(false);
  const [nivelMsg, setNivelMsg] = useState("");

  // Sincronizar cuando cambia patientInfo externamente
  useEffect(() => {
    if (!editingNivel) {
      setNivelDraft(patientInfo?.nivel_actual ?? 1);
    }
  }, [patientInfo?.nivel_actual, editingNivel]);

  const handleSaveNivel = async () => {
    setSavingNivel(true);
    setNivelMsg("");
    try {
      const n = Number(nivelDraft);
      await updatePatient(pacienteId, { nivel_actual: n });
      onNivelChanged?.(n);
      setNivelMsg("¡Nivel actualizado!");
      setEditingNivel(false);
      setTimeout(() => setNivelMsg(""), 2500);
    } catch {
      setNivelMsg("Error al guardar.");
    } finally {
      setSavingNivel(false);
    }
  };

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
        return <span className="badge bg-success text-white">Completada</span>;
      case "in_progress":
        return <span className="badge bg-warning text-white">En progreso</span>;
      case "calibrating":
        return <span className="badge bg-info text-white">Calibrando</span>;
      default:
        return <span className="badge bg-secondary text-white">{status || "—"}</span>;
    }
  };

  return (
    <div className="tem-patient-page">

      {/* ── Nivel TEM ── */}
      <div className="tem-nivel-bar">
        <span className="tem-nivel-label">Nivel TEM actual:</span>
        {!editingNivel ? (
          <>
            <span className={`tem-nivel-badge nivel-${patientInfo?.nivel_actual ?? 1}`}>
              Nivel {patientInfo?.nivel_actual ?? 1}
            </span>
            <button
              className="tem-btn-ghost"
              onClick={() => { setNivelDraft(patientInfo?.nivel_actual ?? 1); setEditingNivel(true); }}
            >
              ✏️ Cambiar
            </button>
          </>
        ) : (
          <>
            <select
              className="tem-nivel-select"
              value={nivelDraft}
              onChange={(e) => setNivelDraft(e.target.value)}
            >
              <option value={1}>Nivel 1</option>
              <option value={2}>Nivel 2</option>
              <option value={3}>Nivel 3</option>
            </select>
            <button className="tem-btn-save" onClick={handleSaveNivel} disabled={savingNivel}>
              {savingNivel ? "Guardando..." : "Guardar"}
            </button>
            <button className="tem-btn-ghost" onClick={() => { setEditingNivel(false); setNivelMsg(""); }}>
              Cancelar
            </button>
          </>
        )}
        {nivelMsg && <span className="tem-nivel-msg">{nivelMsg}</span>}
      </div>

      {/* Sub-tabs */}
      <div className="tem-sub-tabs">
        <button
          className={`tem-sub-tab ${subTab === "sesiones" ? "active" : ""}`}
          onClick={() => setSubTab("sesiones")}
        >
          Sesiones
        </button>
        <button
          className={`tem-sub-tab ${subTab === "asignados" ? "active" : ""}`}
          onClick={() => setSubTab("asignados")}
        >
          Estímulos Asignados
        </button>
      </div>

      {subTab === "sesiones" ? (
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
      ) : (
        <TEMAssignedStimuli
          pacienteId={pacienteId}
          onNewAssignment={() => setShowAssignModal(true)}
        />
      )}

      {/* Modal de asignación */}
      {showAssignModal && (
        <TEMAssignModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          pacienteId={pacienteId}
          patientInfo={patientInfo}
        />
      )}
    </div>
  );
};

export default PacienteTEM;
