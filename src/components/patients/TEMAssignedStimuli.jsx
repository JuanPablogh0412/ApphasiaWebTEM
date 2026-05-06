import React, { useState, useEffect } from "react";
import {
  subscribeActiveAssignment,
  subscribeAssignmentHistory,
  deactivateAssignment,
} from "../../services/asignacionesService";
import { getTEMStimulusById } from "../../services/temService";
import "./TEMAssignedStimuli.css";

const TEMAssignedStimuli = ({ pacienteId, onNewAssignment }) => {
  const [active, setActive] = useState(null);
  const [activeStimuli, setActiveStimuli] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingStimuli, setLoadingStimuli] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Subscribe to active assignment
  useEffect(() => {
    if (!pacienteId) return;
    const unsub = subscribeActiveAssignment(pacienteId, setActive);
    return () => unsub && unsub();
  }, [pacienteId]);

  // Subscribe to history
  useEffect(() => {
    if (!pacienteId) return;
    const unsub = subscribeAssignmentHistory(pacienteId, setHistory);
    return () => unsub && unsub();
  }, [pacienteId]);

  // Resolve stimuli details for active assignment
  useEffect(() => {
    if (!active?.estimulosIds?.length) {
      setActiveStimuli([]);
      return;
    }

    let cancelled = false;
    setLoadingStimuli(true);

    Promise.all(
      active.estimulosIds.map(async (id) => {
        try {
          const s = await getTEMStimulusById(id);
          return s ? { id, ...s } : { id, texto: "(eliminado)", missing: true };
        } catch {
          return { id, texto: "(error)", missing: true };
        }
      })
    ).then((results) => {
      if (!cancelled) {
        setActiveStimuli(results);
        setLoadingStimuli(false);
      }
    });

    return () => { cancelled = true; };
  }, [active]);

  const handleDeactivate = async () => {
    if (!active) return;
    if (!window.confirm("¿Desactivar esta asignación? La app móvil dejará de usar estos estímulos personalizados.")) return;
    setDeactivating(true);
    try {
      await deactivateAssignment(active.id);
    } catch (err) {
      alert("Error al desactivar: " + err.message);
    } finally {
      setDeactivating(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pastAssignments = history.filter((h) => !h.activa);

  return (
    <div className="tas-container">
      {/* Active assignment */}
      {active ? (
        <div className="tas-active-card">
          <div className="tas-active-header">
            <div>
              <h4>Asignación activa</h4>
              <span className="tas-meta">
                Nivel <strong>{active.nivel}</strong> &nbsp;·&nbsp;
                {formatDate(active.activaDesde)} &nbsp;·&nbsp;
                {active.estimulosIds?.length ?? 0} estímulos
              </span>
            </div>
            <div className="tas-active-actions">
              <button
                className="tas-btn-deactivate"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? "Desactivando…" : "Desactivar"}
              </button>
              <button className="tas-btn-new" onClick={onNewAssignment}>
                Nueva asignación
              </button>
            </div>
          </div>

          {active.notas && (
            <p className="tas-notas">
              <strong>Notas:</strong> {active.notas}
            </p>
          )}

          {loadingStimuli ? (
            <p className="tas-loading">Cargando estímulos…</p>
          ) : (
            <div className="tas-stimuli-list">
              {activeStimuli.map((s, i) => (
                <div
                  key={s.id}
                  className={`tas-stimulus-item ${s.missing ? "missing" : ""}`}
                >
                  <span className="tas-stimulus-num">{i + 1}</span>
                  <span className="tas-stimulus-text">{s.texto}</span>
                  {s.patron_tonal && (
                    <span className="tas-stimulus-patron">{s.patron_tonal}</span>
                  )}
                  {s.categoria && (
                    <span className="tas-stimulus-cat">{s.categoria}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="tas-empty">
          <div className="tas-empty-icon">📋</div>
          <p>No hay asignación activa para este paciente.</p>
          <p className="tas-empty-hint">
            La app móvil usará su algoritmo por defecto para seleccionar estímulos.
          </p>
          <button className="tas-btn-new" onClick={onNewAssignment}>
            Crear asignación
          </button>
        </div>
      )}

      {/* History toggle */}
      {pastAssignments.length > 0 && (
        <div className="tas-history-section">
          <button
            className="tas-history-toggle"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "▾" : "▸"} Historial ({pastAssignments.length}{" "}
            asignaci{pastAssignments.length !== 1 ? "ones" : "ón"} anterior
            {pastAssignments.length !== 1 ? "es" : ""})
          </button>

          {showHistory && (
            <div className="tas-history-list">
              {pastAssignments.map((h) => (
                <div key={h.id} className="tas-history-item">
                  <div className="tas-history-meta">
                    <span>
                      Nivel <strong>{h.nivel}</strong>
                    </span>
                    <span>{h.estimulosIds?.length ?? 0} estímulos</span>
                    <span>{formatDate(h.createdAt)}</span>
                  </div>
                  {h.notas && (
                    <p className="tas-history-notas">{h.notas}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TEMAssignedStimuli;
