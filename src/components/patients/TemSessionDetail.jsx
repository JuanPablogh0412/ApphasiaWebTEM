import React, { useEffect, useState } from "react";
import {
  getSessionAnalysisResults,
  getTEMStorageUrl,
  getTEMStimulusById,
  TEM_SCORING,
  computeStepScore,
  getEffectiveScore,
  recalculateSessionScore,
} from "../../services/temService";
import "./TemSessionDetail.css";

const TemSessionDetail = ({ session, patientId, onClose, onOverride }) => {
  const [analysisMap, setAnalysisMap] = useState({});
  const [stimulusNames, setStimulusNames] = useState({});
  const [expandedStimulus, setExpandedStimulus] = useState(null);
  const [audioUrls, setAudioUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [sessionScore, setSessionScore] = useState(null);

  const nivel = session?.nivel || 1;
  const levelConfig = TEM_SCORING[nivel] || TEM_SCORING[1];

  // Cargar análisis y calcular puntaje correcto (Manual Cap. 16)
  useEffect(() => {
    if (!session) return;
    const load = async () => {
      setLoading(true);
      const results = await getSessionAnalysisResults(session.id);

      // Agrupar por stimulusId → paso
      const grouped = {};
      for (const r of results) {
        const sid = r.stimulusId;
        if (!grouped[sid]) grouped[sid] = {};
        const paso = r.paso ?? 0;
        if (!grouped[sid][paso]) grouped[sid][paso] = [];
        grouped[sid][paso].push(r);
      }

      // Ordenar intentos dentro de cada paso
      for (const sid of Object.keys(grouped)) {
        for (const paso of Object.keys(grouped[sid])) {
          grouped[sid][paso].sort((a, b) =>
            (a.attemptId || "").localeCompare(b.attemptId || "")
          );
        }
      }

      setAnalysisMap(grouped);

      // Resolver nombres de estímulos
      const names = {};
      for (const sid of Object.keys(grouped)) {
        try {
          const stim = await getTEMStimulusById(sid);
          if (stim) names[sid] = stim.texto || sid;
        } catch {
          names[sid] = sid;
        }
      }
      setStimulusNames(names);

      // Calcular puntaje correcto de sesión
      const stimulusIds = Object.keys(grouped);
      let obtained = 0;
      for (const stimId of stimulusIds) {
        for (const [paso, attempts] of Object.entries(grouped[stimId])) {
          obtained += computeStepScore(attempts, nivel, Number(paso));
        }
      }
      const attemptedSet = new Set([
        ...(session.completedStimuli || []),
        ...(session.abandonedStimuli || []),
        ...stimulusIds,
      ]);
      const possible = attemptedSet.size * levelConfig.maxPerStimulus;
      const pct = possible > 0 ? Math.round((obtained / possible) * 100) : 0;
      setSessionScore({ obtained, possible, percentage: pct });

      // Guardar puntaje recalculado en Firestore
      recalculateSessionScore(session.id).catch(() => {});

      setLoading(false);
    };
    load();
  }, [session]);

  // Resolver audio URL cuando se expande un estímulo
  const handleToggleStimulus = async (stimulusId) => {
    if (expandedStimulus === stimulusId) {
      setExpandedStimulus(null);
      return;
    }
    setExpandedStimulus(stimulusId);

    const steps = analysisMap[stimulusId] || {};
    for (const paso of Object.keys(steps)) {
      for (const analysis of steps[paso]) {
        const audioPath =
          analysis.audio_info?.storage_path ||
          analysis.audio_info?.cleaned_download_url;
        if (audioPath && !audioUrls[analysis.id]) {
          try {
            const url = await getTEMStorageUrl(audioPath);
            setAudioUrls((prev) => ({ ...prev, [analysis.id]: url }));
          } catch {
            // Audio no disponible
          }
        }
      }
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const scoreClass = (score, max) => {
    if (score == null || max == null) return "";
    if (score >= max) return "good";
    if (score > 0) return "medium";
    return "low";
  };

  const statusBadge = (status) => {
    switch (status) {
      case "completed":
        return <span className="badge bg-success">Completada</span>;
      case "in_progress":
        return <span className="badge bg-warning">En progreso</span>;
      case "abandoned":
        return <span className="badge bg-danger">Abandonada</span>;
      default:
        return <span className="badge bg-secondary">{status || "—"}</span>;
    }
  };

  const getStimulusScore = (stimulusId) => {
    const steps = analysisMap[stimulusId] || {};
    let obtained = 0;
    for (const [paso, attempts] of Object.entries(steps)) {
      obtained += computeStepScore(attempts, nivel, Number(paso));
    }
    return obtained;
  };

  const getStepLabel = (paso) =>
    levelConfig.steps[paso]?.name || `Paso ${paso}`;

  const getStepMax = (paso) =>
    levelConfig.steps[paso]?.max ?? 1;

  if (!session) return null;

  const stimulusIds = Object.keys(analysisMap);
  const orderedStimulusIds = session.estimulosSecuencia
    ? session.estimulosSecuencia.filter((id) => stimulusIds.includes(id))
    : stimulusIds;
  for (const sid of stimulusIds) {
    if (!orderedStimulusIds.includes(sid)) orderedStimulusIds.push(sid);
  }

  return (
    <div className="tem-session-backdrop" onClick={onClose}>
      <div className="tem-session-modal" onClick={(e) => e.stopPropagation()}>
        {/* === HEADER === */}
        <header className="tem-session-header">
          <h4>Sesión TEM — {levelConfig.name}</h4>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>

        {/* === META === */}
        <div className="tem-session-meta">
          <p><strong>Inicio:</strong> {formatDate(session.startedAt)}</p>
          {session.completedAt && (
            <p><strong>Fin:</strong> {formatDate(session.completedAt)}</p>
          )}
          <p><strong>Estado:</strong> {statusBadge(session.status)}</p>
          <p><strong>Nivel:</strong> {nivel}</p>
          {sessionScore && (
            <p>
              <strong>Puntaje total:</strong>{" "}
              <span className={`attempt-score ${scoreClass(sessionScore.obtained, sessionScore.possible)}`}>
                {sessionScore.obtained} / {sessionScore.possible} ({sessionScore.percentage}%)
              </span>
            </p>
          )}
          {session.completedStimuli && (
            <p>
              <strong>Estímulos completados:</strong>{" "}
              {session.completedStimuli.length} / {session.estimulosSecuencia?.length ?? "—"}
            </p>
          )}
          {session.abandonedStimuli?.length > 0 && (
            <p>
              <strong>Estímulos abandonados:</strong>{" "}
              {session.abandonedStimuli.length}
            </p>
          )}
        </div>

        {/* === LEYENDA DE PUNTUACIÓN === */}
        <div className="tem-scoring-legend">
          <p>
            <strong>Puntuación {levelConfig.name}:</strong>{" "}
            {Object.entries(levelConfig.steps)
              .filter(([, s]) => s.scored)
              .map(([, s]) => `${s.name} (0–${s.max})`)
              .join(" · ")}
            {" · "}
            <strong>Máx. por estímulo: {levelConfig.maxPerStimulus}</strong>
          </p>
        </div>

        {/* === CONTENIDO === */}
        {loading ? (
          <div className="tem-loading">
            <div className="spinner-border text-warning" role="status"></div>
            <p className="mt-3 fw-semibold">Cargando análisis...</p>
          </div>
        ) : orderedStimulusIds.length === 0 ? (
          <p className="text-center text-muted py-4">
            No hay análisis registrados en esta sesión.
          </p>
        ) : (
          orderedStimulusIds.map((stimId) => {
            const stimScore = getStimulusScore(stimId);
            return (
              <div key={stimId} className="tem-stimulus-card">
                {/* Stimulus header (accordion) */}
                <div
                  className="tem-stimulus-header"
                  onClick={() => handleToggleStimulus(stimId)}
                >
                  <h5>{stimulusNames[stimId] || stimId}</h5>
                  <div className="stimulus-score-row">
                    <span
                      className={`stimulus-score ${scoreClass(
                        stimScore,
                        levelConfig.maxPerStimulus
                      )}`}
                    >
                      {stimScore} / {levelConfig.maxPerStimulus}
                    </span>
                    <span
                      className={`toggle-icon ${
                        expandedStimulus === stimId ? "open" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </div>
                </div>

                {/* Stimulus body (expanded) — muestra TODOS los pasos del nivel */}
                {expandedStimulus === stimId && (
                  <div className="tem-stimulus-body">
                    {Object.entries(levelConfig.steps)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([pasoKey, stepDef]) => {
                        const paso = pasoKey;
                        const attempts = analysisMap[stimId]?.[paso] || [];
                        const stepMax = stepDef.max;
                        const stepScore = computeStepScore(
                          attempts,
                          nivel,
                          Number(paso)
                        );
                        return (
                          <div key={paso} className="tem-step-card">
                            <div className="tem-step-header-row">
                              <h6>{stepDef.name}</h6>
                              {!stepDef.scored ? (
                                <span className="step-score-badge muted">
                                  Sin puntuación
                                </span>
                              ) : attempts.length === 0 ? (
                                <span className="step-score-badge muted">
                                  No intentado
                                </span>
                              ) : (
                                <span
                                  className={`step-score-badge ${scoreClass(
                                    stepScore,
                                    stepMax
                                  )}`}
                                >
                                  {stepScore} / {stepMax}
                                </span>
                              )}
                            </div>

                            {attempts.length === 0 && (
                              <p className="text-muted" style={{ fontSize: "0.85rem", margin: "0.3rem 0" }}>
                                {stepDef.scored
                                  ? "El paciente no alcanzó este paso."
                                  : "Paso de presentación — sin registro."}
                              </p>
                            )}

                            {attempts.map((analysis) => {
                              const effectiveScore =
                                getEffectiveScore(analysis);
                              const hasOverride =
                                analysis.override_score != null;
                              return (
                                <div key={analysis.id} className="tem-attempt">
                                  {/* Audio */}
                                  <div>
                                    {audioUrls[analysis.id] ? (
                                      <audio controls preload="none">
                                        <source
                                          src={audioUrls[analysis.id]}
                                          type="audio/wav"
                                        />
                                      </audio>
                                    ) : (
                                      <span
                                        className="text-muted"
                                        style={{ fontSize: "0.8rem" }}
                                      >
                                        Sin audio
                                      </span>
                                    )}
                                  </div>

                                  {/* Scores */}
                                  <div className="attempt-info">
                                    <p>
                                      <strong>Puntaje TEM:</strong>{" "}
                                      <span
                                        className={`attempt-score ${scoreClass(
                                          effectiveScore,
                                          stepMax
                                        )}`}
                                      >
                                        {effectiveScore}
                                      </span>
                                      <span className="score-max">
                                        {" "}
                                        / {stepMax}
                                      </span>
                                      {hasOverride && (
                                        <span className="override-badge">
                                          Sobreescrito
                                        </span>
                                      )}
                                    </p>
                                    {hasOverride && (
                                      <p className="override-detail">
                                        <strong>Automático:</strong>{" "}
                                        {analysis.clinical_score}
                                        {analysis.override_notes &&
                                          ` — ${analysis.override_notes}`}
                                      </p>
                                    )}
                                    {analysis.is_intelligible != null && (
                                      <p>
                                        <strong>¿Inteligible?</strong>{" "}
                                        {analysis.is_intelligible ? "Sí" : "No"}
                                      </p>
                                    )}
                                    {/* Detalle análisis automático (colapsable) */}
                                    <details className="ai-detail-section">
                                      <summary>Detalle análisis automático</summary>
                                      <div className="ai-scores-grid">
                                        {analysis.voice_score != null && (
                                          <span>
                                            Voz:{" "}
                                            {(
                                              analysis.voice_score * 100
                                            ).toFixed(0)}
                                            %
                                          </span>
                                        )}
                                        {analysis.pitch_score != null && (
                                          <span>
                                            Tono:{" "}
                                            {(
                                              analysis.pitch_score * 100
                                            ).toFixed(0)}
                                            %
                                          </span>
                                        )}
                                        {analysis.rhythm_score != null && (
                                          <span>
                                            Ritmo:{" "}
                                            {(
                                              analysis.rhythm_score * 100
                                            ).toFixed(0)}
                                            %
                                          </span>
                                        )}
                                        {analysis.intelligibility_score !=
                                          null && (
                                          <span>
                                            Inteligibilidad:{" "}
                                            {(
                                              analysis.intelligibility_score *
                                              100
                                            ).toFixed(0)}
                                            %
                                          </span>
                                        )}
                                        {analysis.confidence != null && (
                                          <span>
                                            Confianza:{" "}
                                            {(
                                              analysis.confidence * 100
                                            ).toFixed(0)}
                                            %
                                          </span>
                                        )}
                                      </div>
                                    </details>
                                  </div>

                                  {/* Override button */}
                                  {onOverride && (
                                    <button
                                      className="btn-override"
                                      onClick={() =>
                                        onOverride({
                                          patientId,
                                          sessionId: session.id,
                                          analysisId: analysis.id,
                                          nivel,
                                          paso: Number(paso),
                                          attempt: {
                                            score: analysis.clinical_score,
                                            override_score:
                                              analysis.override_score,
                                            override_notes:
                                              analysis.override_notes,
                                          },
                                        })
                                      }
                                    >
                                      Sobreescribir
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TemSessionDetail;
