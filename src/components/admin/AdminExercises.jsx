import React, { useEffect, useState, useMemo } from "react";
import {
  getAllExercises,
  getExerciseDetails,
  deleteExercise,
} from "../../services/exercisesService";
import {
  subscribeApprovedTEMStimuli,
  deleteTEMStimulus,
  getTEMStorageUrl,
} from "../../services/temService";
import { getPatientById } from "../../services/patientService";
import VNESTTable from "../exercises/VNESTTable";
import SRTable from "../exercises/SRTable";
import VNESTEditor from "../editExercises/VNESTEditor";
import SREditor from "../editExercises/SREditor";
import VNESTExerciseModal from "../exercises/VNESTExerciseModal";
import SRExerciseModal from "../exercises/SRExerciseModal";
import TEMStimulusModal from "../exercises/TEMStimulusModal";
import AdminTEMStimulusEditor from "./AdminTEMStimulusEditor";
import "./AdminExercises.css";

const SUBTABS = [
  { key: "VNEST", label: "VNEST" },
  { key: "SR", label: "SR" },
  { key: "TEM", label: "TEM" },
];

export default function AdminExercises() {
  const [subTab, setSubTab] = useState("VNEST");

  // ── Ejercicios (VNEST + SR + TEM) ───────────────────────────────
  const [exercises, setExercises] = useState([]);
  const [loadingExercises, setLoadingExercises] = useState(true);

  // VNEST modals
  const [vnestEditing, setVnestEditing] = useState(null);
  const [vnestViewing, setVnestViewing] = useState(null);
  const [vnestViewData, setVnestViewData] = useState(null);

  // SR modals
  const [srEditing, setSrEditing] = useState(null);
  const [srViewing, setSrViewing] = useState(null);
  const [srViewData, setSrViewData] = useState(null);

  // Confirmación eliminación (ejercicios genéricos)
  const [deletingId, setDeletingId] = useState(null);
  const [deletingTerapia, setDeletingTerapia] = useState(null);

  // ── Estímulos TEM aprobados ──────────────────────────────────────
  const [stimuli, setStimuli] = useState([]);
  const [loadingStimuli, setLoadingStimuli] = useState(true);

  // TEM stimulus modals
  const [temViewing, setTemViewing] = useState(null);
  const [temEditing, setTemEditing] = useState(null);
  const [temDeletingId, setTemDeletingId] = useState(null);

  // ── Cargar ejercicios (VNEST + SR de colección ejercicios) ──
  useEffect(() => {
    setLoadingExercises(true);
    const unsub = getAllExercises(async (rawList) => {
      const detailed = await Promise.allSettled(
        rawList.map(async (e) => {
          try {
            const extra = await getExerciseDetails(e.id, e.terapia);
            const extraData =
              Array.isArray(extra) && extra.length > 0 ? extra[0] : extra || {};

            let pacienteNombre = null;
            let pacienteEmail = null;
            if (e.id_paciente) {
              try {
                const p = await getPatientById(e.id_paciente);
                if (p) {
                  pacienteNombre = p.nombre || null;
                  pacienteEmail = p.email || null;
                }
              } catch { /* ignore */ }
            }

            return { ...e, ...extraData, pacienteNombre, pacienteEmail };
          } catch {
            return e;
          }
        })
      );
      setExercises(
        detailed.filter((r) => r.status === "fulfilled").map((r) => r.value)
      );
      setLoadingExercises(false);
    });
    return () => unsub();
  }, []);

  // ── Cargar estímulos TEM aprobados ──────────────────────────────
  useEffect(() => {
    setLoadingStimuli(true);
    const unsub = subscribeApprovedTEMStimuli((data) => {
      setStimuli(data);
      setLoadingStimuli(false);
    });
    return () => unsub();
  }, []);

  // ── Eliminar ejercicio (VNEST / SR) ─────────────────────────────
  const handleDeleteExercise = async (id, terapia) => {
    try {
      await deleteExercise(id, terapia);
    } catch (err) {
      console.error("Error al eliminar ejercicio:", err);
    } finally {
      setDeletingId(null);
      setDeletingTerapia(null);
    }
  };

  // ── Eliminar estímulo TEM ────────────────────────────────────────
  const handleDeleteStimulus = async (id) => {
    try {
      await deleteTEMStimulus(id);
    } catch (err) {
      console.error("Error al eliminar estímulo:", err);
    } finally {
      setTemDeletingId(null);
    }
  };

  // ── Abrir modal de vista VNEST ───────────────────────────────────
  const handleViewVnest = async (exercise) => {
    try {
      const data = await getExerciseDetails(exercise.id, "VNEST");
      setVnestViewData(data);
    } catch {
      setVnestViewData(null);
    }
    setVnestViewing(exercise);
  };

  // ── Abrir modal de vista SR ──────────────────────────────────────
  const handleViewSR = async (exercise) => {
    try {
      const data = await getExerciseDetails(exercise.id, "SR");
      setSrViewData(data);
    } catch {
      setSrViewData(null);
    }
    setSrViewing(exercise);
  };

  return (
    <div className="admin-exercises">
      {/* Sub-tabs */}
      <div className="ae-subtabs">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            className={`ae-subtab-btn ${subTab === t.key ? "active" : ""}`}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ VNEST ══ */}
      {subTab === "VNEST" && (
        <div className="ae-content">
          {loadingExercises ? (
            <LoadingSpinner text="Cargando ejercicios VNEST..." />
          ) : (
            <VNESTTable
              exercises={exercises}
              onEdit={(ex) => setVnestEditing(ex)}
              onView={(ex) => handleViewVnest(ex)}
              onDelete={(ex) => { setDeletingId(ex.id); setDeletingTerapia("VNEST"); }}
            />
          )}
          {deletingId && deletingTerapia === "VNEST" && (
            <ConfirmDelete
              text="¿Eliminar este ejercicio VNEST? Esta acción no se puede deshacer."
              onConfirm={() => handleDeleteExercise(deletingId, "VNEST")}
              onCancel={() => { setDeletingId(null); setDeletingTerapia(null); }}
            />
          )}
          <VNESTEditor
            open={!!vnestEditing}
            onClose={() => setVnestEditing(null)}
            exercise={vnestEditing}
          />
          {vnestViewing && (
            <VNESTExerciseModal
              exercise={vnestViewing}
              details={vnestViewData}
              onClose={() => { setVnestViewing(null); setVnestViewData(null); }}
            />
          )}
        </div>
      )}

      {/* ══ SR ══ */}
      {subTab === "SR" && (
        <div className="ae-content">
          {loadingExercises ? (
            <LoadingSpinner text="Cargando ejercicios SR..." />
          ) : (
            <SRTable
              exercises={exercises}
              onEdit={(ex) => setSrEditing(ex)}
              onView={(ex) => handleViewSR(ex)}
              onDelete={(ex) => { setDeletingId(ex.id); setDeletingTerapia("SR"); }}
            />
          )}
          {deletingId && deletingTerapia === "SR" && (
            <ConfirmDelete
              text="¿Eliminar este ejercicio SR? Esta acción no se puede deshacer."
              onConfirm={() => handleDeleteExercise(deletingId, "SR")}
              onCancel={() => { setDeletingId(null); setDeletingTerapia(null); }}
            />
          )}
          <SREditor
            open={!!srEditing}
            onClose={() => setSrEditing(null)}
            exercise={srEditing}
          />
          {srViewing && (
            <SRExerciseModal
              exercise={srViewing}
              details={srViewData}
              onClose={() => { setSrViewing(null); setSrViewData(null); }}
            />
          )}
        </div>
      )}

      {/* ══ TEM — Estímulos aprobados ══ */}
      {subTab === "TEM" && (
        <div className="ae-content">
          {loadingStimuli ? (
            <LoadingSpinner text="Cargando estímulos TEM..." />
          ) : stimuli.length === 0 ? (
            <p className="ae-empty">No hay estímulos TEM aprobados.</p>
          ) : (
            <div className="ae-table-wrapper">
              <table className="ae-table">
                <thead>
                  <tr>
                    <th>Texto</th>
                    <th>Nivel</th>
                    <th>Categoría</th>
                    <th>Patrón tonal</th>
                    <th>Sílabas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {stimuli.map((s) => (
                    <tr key={s.id}>
                      <td className="ae-cell-bold">{s.texto}</td>
                      <td>
                        <span className="ae-nivel-badge">Nv. {s.nivel_clinico}</span>
                      </td>
                      <td>{s.categoria || "—"}</td>
                      <td className="ae-monospace">{s.patron_tonal || "—"}</td>
                      <td>{s.num_silabas ?? "—"}</td>
                      <td>
                        {temDeletingId === s.id ? (
                          <div className="ae-inline-confirm">
                            <span>¿Eliminar?</span>
                            <button
                              className="ae-btn-confirm"
                              onClick={() => handleDeleteStimulus(s.id)}
                            >
                              Sí
                            </button>
                            <button
                              className="ae-btn-cancel-sm"
                              onClick={() => setTemDeletingId(null)}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="ae-actions">
                            <button
                              className="ae-btn-secondary-sm"
                              onClick={() => setTemViewing(s)}
                              title="Ver detalles"
                            >
                              🔍 Ver
                            </button>
                            <button
                              className="ae-btn-primary-sm"
                              onClick={() => setTemEditing(s)}
                              title="Editar metadatos"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              className="ae-btn-danger-sm"
                              onClick={() => setTemDeletingId(s.id)}
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {temViewing && (
            <TEMStimulusModal
              stimulus={temViewing}
              onClose={() => setTemViewing(null)}
            />
          )}
          {temEditing && (
            <AdminTEMStimulusEditor
              stimulus={temEditing}
              onClose={() => setTemEditing(null)}
              onSaved={() => setTemEditing(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers locales ──────────────────────────────────────────────────

function LoadingSpinner({ text }) {
  return (
    <div className="ae-loading">
      <div className="ae-spinner" />
      <p>{text}</p>
    </div>
  );
}

function ConfirmDelete({ text, onConfirm, onCancel }) {
  return (
    <div className="ae-confirm-overlay" onClick={onCancel}>
      <div className="ae-confirm-box" onClick={(e) => e.stopPropagation()}>
        <p>{text}</p>
        <div className="ae-confirm-actions">
          <button className="ae-btn-danger-sm" onClick={onConfirm}>
            Eliminar
          </button>
          <button className="ae-btn-cancel-sm" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
