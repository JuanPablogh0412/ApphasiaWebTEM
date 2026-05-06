import React, { useState, useEffect, useMemo } from "react";
import { subscribeTEMStimuliApproved } from "../../services/temService";
import { createAssignment } from "../../services/asignacionesService";
import { useAuth } from "../../context/AuthContext";
import TEMStimulusModal from "../exercises/TEMStimulusModal";
import "./TEMAssignModal.css";

const TEMAssignModal = ({ open, onClose, pacienteId, patientInfo }) => {
  const { user } = useAuth();
  const [stimuli, setStimuli] = useState([]);
  const [selected, setSelected] = useState([]);
  const [detailStimulus, setDetailStimulus] = useState(null);
  const [filterNivel, setFilterNivel] = useState(null); // null = auto from patient
  const [filterTexto, setFilterTexto] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const nivelActual = patientInfo?.nivel_actual ?? 1;

  // Set nivel filter to patient's nivel_actual on mount
  useEffect(() => {
    setFilterNivel(nivelActual);
  }, [nivelActual]);

  // Subscribe to approved stimuli
  useEffect(() => {
    const unsub = subscribeTEMStimuliApproved(setStimuli);
    return () => unsub && unsub();
  }, []);

  // Extract unique categories
  const categorias = useMemo(() => {
    const cats = new Set(stimuli.map((s) => s.categoria).filter(Boolean));
    return [...cats].sort();
  }, [stimuli]);

  // Filtered stimuli
  const filtered = useMemo(() => {
    return stimuli.filter((s) => {
      if (filterNivel && s.nivel_clinico !== filterNivel) return false;
      if (filterTexto && !s.texto?.toLowerCase().includes(filterTexto.toLowerCase())) return false;
      if (filterCategoria && s.categoria !== filterCategoria) return false;
      return true;
    });
  }, [stimuli, filterNivel, filterTexto, filterCategoria]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [filterNivel, filterTexto, filterCategoria]);

  const isSelected = (id) => selected.some((s) => s.id === id);

  const toggleSelect = (stimulus) => {
    if (isSelected(stimulus.id)) {
      setSelected((prev) => prev.filter((s) => s.id !== stimulus.id));
    } else {
      setSelected((prev) => [...prev, stimulus]);
    }
    setError("");
  };

  const removeSelected = (id) => {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  };

  const handleNivelChange = (newNivel) => {
    if (selected.length > 0 && newNivel !== filterNivel) {
      if (!window.confirm("Cambiar de nivel limpiará los estímulos seleccionados. ¿Continuar?")) return;
      setSelected([]);
    }
    setFilterNivel(newNivel);
  };

  const handleAssign = async () => {
    if (selected.length < 5) {
      setError("Se requieren al menos 5 estímulos para crear una asignación.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createAssignment({
        terapeutaId: user.uid,
        pacienteId,
        estimulosIds: selected.map((s) => s.id),
        nivel: filterNivel || nivelActual,
        notas: "",
      });
      onClose();
    } catch (err) {
      setError(err.message || "Error al crear la asignación.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="tem-assign-overlay" onClick={onClose}>
      <div className="tem-assign-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tam-header">
          <div>
            <h3>Asignar Estímulos TEM</h3>
            <p className="tam-subtitle">
              Paciente: <strong>{patientInfo?.nombre || "—"}</strong> &nbsp;·&nbsp;
              Nivel actual: <strong>{nivelActual}</strong>
            </p>
          </div>
          <button className="tam-close" onClick={onClose}>✕</button>
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="tam-selected-bar">
            <span className="tam-selected-count">{selected.length} estímulo{selected.length !== 1 ? "s" : ""} seleccionado{selected.length !== 1 ? "s" : ""}</span>
            <div className="tam-chips">
              {selected.map((s) => (
                <span key={s.id} className="tam-chip">
                  {s.texto}
                  <button onClick={() => removeSelected(s.id)}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="tam-filters">
          <div className="tam-filter-group">
            <label>Nivel:</label>
            <div className="tam-nivel-btns">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={`tam-nivel-btn ${filterNivel === n ? "active" : ""} ${n !== nivelActual ? "other-level" : ""}`}
                  onClick={() => handleNivelChange(n)}
                  title={n !== nivelActual ? `Nivel ${n} — No es el nivel actual del paciente (${nivelActual})` : `Nivel ${n} — Nivel actual del paciente`}
                >
                  {n}
                  {n !== nivelActual && <span className="tam-warn-dot">!</span>}
                </button>
              ))}
            </div>
            {filterNivel && filterNivel !== nivelActual && (
              <span className="tam-nivel-warning">
                ⚠ Nivel {filterNivel} no es el nivel actual del paciente ({nivelActual}).
                Estos estímulos quedan reservados para cuando avance.
              </span>
            )}
          </div>

          <div className="tam-filter-group">
            <label>Buscar:</label>
            <input
              type="text"
              placeholder="Buscar por texto..."
              value={filterTexto}
              onChange={(e) => setFilterTexto(e.target.value)}
            />
          </div>

          <div className="tam-filter-group">
            <label>Categoría:</label>
            <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stimuli table */}
        <div className="tam-table-wrap">
          <table className="tam-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Texto</th>
                <th>Nivel</th>
                <th>Categoría</th>
                <th>Sílabas</th>
                <th>Patrón Tonal</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    No se encontraron estímulos con esos filtros.
                  </td>
                  <td></td>
                </tr>
              ) : (
                paginated.map((s) => (
                  <tr
                    key={s.id}
                    className={isSelected(s.id) ? "tam-row-selected" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected(s.id)}
                        onChange={() => toggleSelect(s)}
                      />
                    </td>
                    <td className="tam-text-cell">{s.texto}</td>
                    <td>{s.nivel_clinico}</td>
                    <td>{s.categoria || "—"}</td>
                    <td>{s.num_silabas ?? s.syllables?.length ?? "—"}</td>
                    <td>
                      <span className="tam-patron">{s.patron_tonal || "—"}</span>
                    </td>
                    <td>
                      <button
                        className="tam-detail-btn"
                        onClick={(e) => { e.stopPropagation(); setDetailStimulus(s); }}
                        title="Ver detalle"
                      >
                        🔍
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="tam-pagination">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={p === currentPage ? "active" : ""} onClick={() => setCurrentPage(p)}>{p}</button>
            ))}
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
          </div>
        )}

        {/* Error */}
        {error && <div className="tam-error">{error}</div>}

        {/* Actions */}
        <div className="tam-actions">
          <button className="tam-btn-cancel" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="tam-btn-assign" onClick={handleAssign} disabled={saving || selected.length < 5}>
            {saving ? "Asignando..." : `Asignar ${selected.length} estímulo${selected.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {/* Detail modal */}
      {detailStimulus && (
        <TEMStimulusModal
          stimulus={detailStimulus}
          onClose={() => setDetailStimulus(null)}
        />
      )}
    </div>
  );
};

export default TEMAssignModal;
