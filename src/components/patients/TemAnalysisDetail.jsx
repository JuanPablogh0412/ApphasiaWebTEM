import React, { useState } from "react";
import { overrideTEMAnalysis, TEM_SCORING } from "../../services/temService";
import "./TemAnalysisDetail.css";

const TemAnalysisDetail = ({ data, onClose, onSaved }) => {
  const nivel = data.nivel || 1;
  const paso = data.paso || 2;
  const levelConfig = TEM_SCORING[nivel] || TEM_SCORING[1];
  const stepConfig = levelConfig.steps[paso];
  const maxScore = stepConfig?.max ?? 1;

  const [score, setScore] = useState(
    data.attempt?.override_score ?? data.attempt?.score ?? ""
  );
  const [notes, setNotes] = useState(data.attempt?.override_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > maxScore) return;

    setSaving(true);
    try {
      await overrideTEMAnalysis(
        data.analysisId,
        { override_score: numScore, override_notes: notes },
        data.sessionId
      );
      setSaved(true);
      if (onSaved) onSaved();
    } catch {
      // Error silencioso
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  const scoreOptions = Array.from({ length: maxScore + 1 }, (_, i) => i);

  return (
    <div className="tem-analysis-backdrop" onClick={onClose}>
      <div
        className="tem-analysis-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* === HEADER === */}
        <header className="tem-analysis-header">
          <h4>Sobreescribir evaluación</h4>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>

        {/* === INFO ACTUAL === */}
        <section className="tem-analysis-info">
          <p><strong>Nivel:</strong> {nivel} — {levelConfig.name}</p>
          <p><strong>Paso:</strong> {stepConfig?.name || `Paso ${paso}`}</p>
          <p><strong>Puntaje máximo:</strong> {maxScore}</p>
          {data.attempt?.score != null && (
            <p>
              <strong>Puntaje automático:</strong>{" "}
              {data.attempt.score} / {maxScore}
            </p>
          )}
        </section>

        {/* === FORMULARIO === */}
        {saved ? (
          <div className="tem-override-success">
            ✓ Evaluación sobreescrita y puntaje de sesión recalculado
          </div>
        ) : (
          <div className="tem-override-form">
            <div>
              <label>Nuevo puntaje</label>
              <div className="score-buttons">
                {scoreOptions.map((val) => (
                  <button
                    key={val}
                    type="button"
                    className={`score-btn ${
                      Number(score) === val ? "active" : ""
                    }`}
                    onClick={() => setScore(val)}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="score-hint">
                {maxScore === 1
                  ? "0 = no logrado · 1 = logrado"
                  : "0 = no logrado · 1 = logrado con retroceso · 2 = logrado sin retroceso"}
              </p>
            </div>

            <div>
              <label htmlFor="override-notes">Notas del terapeuta</label>
              <textarea
                id="override-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones sobre el desempeño del paciente..."
              />
            </div>

            <div className="tem-override-actions">
              <button className="btn-cancel" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={saving || score === ""}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemAnalysisDetail;
