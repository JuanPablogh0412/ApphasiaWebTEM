import React, { useState } from "react";
import { updatePatient } from "../../services/patientService";
import "./PatientProfile.css";

const NIVEL_LABELS = { 1: "Nivel 1", 2: "Nivel 2", 3: "Nivel 3" };

const PatientProfile = ({ patientInfo, pacienteId, onSwitchToTEM, onNivelChanged }) => {
  const [editingNivel, setEditingNivel] = useState(false);
  const [nivelDraft, setNivelDraft] = useState(patientInfo?.nivel_actual ?? 1);
  const [savingNivel, setSavingNivel] = useState(false);
  const [nivelMsg, setNivelMsg] = useState("");

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
      setNivelMsg("Error al guardar el nivel.");
    } finally {
      setSavingNivel(false);
    }
  };

  const handleCancelNivel = () => {
    setNivelDraft(patientInfo?.nivel_actual ?? 1);
    setEditingNivel(false);
    setNivelMsg("");
  };

  if (!patientInfo) {
    return <div className="pp-loading">Cargando perfil...</div>;
  }

  const familia = patientInfo.familia || [];
  const objetos = patientInfo.objetos || [];
  const rutinas = patientInfo.rutinas || [];

  // Sugerencias derivadas
  const sugerencias = [
    ...familia.map((f) => ({
      key: `fam-${f.nombre}`,
      icon: "👤",
      titulo: f.nombre,
      subtitulo: f.tipo_relacion,
      descripcion: f.descripcion,
      origen: "Familiar",
    })),
    ...objetos.map((o) => ({
      key: `obj-${o.nombre}`,
      icon: "🏷️",
      titulo: o.nombre,
      subtitulo: o.tipo_relacion,
      descripcion: o.descripcion,
      origen: "Objeto / Mascota",
    })),
    ...rutinas.map((r) => ({
      key: `rut-${r.titulo}`,
      icon: "📅",
      titulo: r.titulo,
      subtitulo: "Rutina",
      descripcion: r.descripcion,
      origen: "Rutina",
    })),
  ];

  return (
    <div className="pp-container">

      {/* ── Datos básicos ── */}
      <section className="pp-section">
        <h3 className="pp-section-title">Datos básicos</h3>
        <div className="pp-basic-grid">
          <div className="pp-field">
            <span className="pp-label">Nombre completo</span>
            <span className="pp-value">{patientInfo.nombre || "—"}</span>
          </div>
          <div className="pp-field">
            <span className="pp-label">Correo electrónico</span>
            <span className="pp-value">{patientInfo.email || "—"}</span>
          </div>
          <div className="pp-field">
            <span className="pp-label">Fecha de nacimiento</span>
            <span className="pp-value">{patientInfo.fecha_nacimiento || "—"}</span>
          </div>
          <div className="pp-field">
            <span className="pp-label">Lugar de nacimiento</span>
            <span className="pp-value">{patientInfo.lugar_nacimiento || "—"}</span>
          </div>
          <div className="pp-field">
            <span className="pp-label">Ciudad de residencia</span>
            <span className="pp-value">{patientInfo.ciudad_residencia || "—"}</span>
          </div>
        </div>
      </section>

      {/* ── Nivel TEM ── */}
      <section className="pp-section">
        <h3 className="pp-section-title">Nivel TEM (Terapia de Entonación Melódica)</h3>
        <div className="pp-nivel-row">
          {!editingNivel ? (
            <>
              <span className={`pp-nivel-badge nivel-${patientInfo.nivel_actual ?? 1}`}>
                {NIVEL_LABELS[patientInfo.nivel_actual] ?? "Sin nivel"}
              </span>
              <button className="pp-btn-ghost" onClick={() => { setNivelDraft(patientInfo.nivel_actual ?? 1); setEditingNivel(true); }}>
                ✏️ Editar nivel
              </button>
            </>
          ) : (
            <>
              <select
                className="pp-select"
                value={nivelDraft}
                onChange={(e) => setNivelDraft(e.target.value)}
              >
                <option value={1}>Nivel 1</option>
                <option value={2}>Nivel 2</option>
                <option value={3}>Nivel 3</option>
              </select>
              <button className="pp-btn-save" onClick={handleSaveNivel} disabled={savingNivel}>
                {savingNivel ? "Guardando..." : "Guardar"}
              </button>
              <button className="pp-btn-ghost" onClick={handleCancelNivel}>
                Cancelar
              </button>
            </>
          )}
          {nivelMsg && <span className="pp-nivel-msg">{nivelMsg}</span>}
        </div>
      </section>

      {/* ── Familia ── */}
      {familia.length > 0 && (
        <section className="pp-section">
          <h3 className="pp-section-title">Familia</h3>
          <div className="pp-cards-grid">
            {familia.map((f, i) => (
              <div key={i} className="pp-card">
                <div className="pp-card-header">
                  <span className="pp-card-icon">👤</span>
                  <div>
                    <span className="pp-card-name">{f.nombre}</span>
                    <span className="pp-card-badge">{f.tipo_relacion}</span>
                  </div>
                </div>
                {f.descripcion && <p className="pp-card-desc">{f.descripcion}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Objetos y mascotas ── */}
      {objetos.length > 0 && (
        <section className="pp-section">
          <h3 className="pp-section-title">Objetos y mascotas</h3>
          <div className="pp-cards-grid">
            {objetos.map((o, i) => (
              <div key={i} className="pp-card">
                <div className="pp-card-header">
                  <span className="pp-card-icon">🏷️</span>
                  <div>
                    <span className="pp-card-name">{o.nombre}</span>
                    <span className="pp-card-badge">{o.tipo_relacion}</span>
                  </div>
                </div>
                {o.descripcion && <p className="pp-card-desc">{o.descripcion}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Rutinas ── */}
      {rutinas.length > 0 && (
        <section className="pp-section">
          <h3 className="pp-section-title">Rutinas y actividades</h3>
          <div className="pp-cards-grid">
            {rutinas.map((r, i) => (
              <div key={i} className="pp-card">
                <div className="pp-card-header">
                  <span className="pp-card-icon">📅</span>
                  <div>
                    <span className="pp-card-name">{r.titulo}</span>
                    <span className="pp-card-badge">Rutina</span>
                  </div>
                </div>
                {r.descripcion && <p className="pp-card-desc">{r.descripcion}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Sugerencias TEM ── */}
      {sugerencias.length > 0 && (
        <section className="pp-section pp-section-suggestions">
          <div className="pp-suggestions-header">
            <div>
              <h3 className="pp-section-title">💡 Sugerencias para ejercicios TEM</h3>
              <p className="pp-suggestions-subtitle">
                Basado en los datos del paciente, estos elementos pueden ser buenos contextos para crear estímulos TEM personalizados.
              </p>
            </div>
            <button className="pp-btn-tem" onClick={onSwitchToTEM}>
              Ir a TEM →
            </button>
          </div>
          <div className="pp-suggestions-grid">
            {sugerencias.map((s) => (
              <div key={s.key} className="pp-suggestion-card">
                <div className="pp-suggestion-top">
                  <span className="pp-suggestion-icon">{s.icon}</span>
                  <div className="pp-suggestion-info">
                    <span className="pp-suggestion-name">{s.titulo}</span>
                    <span className="pp-suggestion-origen">{s.origen} · {s.subtitulo}</span>
                  </div>
                </div>
                {s.descripcion && (
                  <p className="pp-suggestion-desc">"{s.descripcion}"</p>
                )}
                <button className="pp-btn-suggestion-tem" onClick={onSwitchToTEM}>
                  Crear ejercicio TEM →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {familia.length === 0 && objetos.length === 0 && rutinas.length === 0 && (
        <section className="pp-section">
          <p className="pp-empty">Este paciente no tiene datos personales adicionales registrados.</p>
        </section>
      )}
    </div>
  );
};

export default PatientProfile;
