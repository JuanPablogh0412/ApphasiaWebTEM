import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  subscribeToSolicitudes,
  approveSolicitud,
  rejectSolicitud,
  subscribeTEMStimuliPending,
  approveEstimulo,
  rejectEstimulo,
} from "../../services/adminService";
import { getTEMStorageUrl } from "../../services/temService";
import { getUserDisplayInfo } from "../../services/therapistService";
import AdminExercises from "./AdminExercises";
import "./Admin.css";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };
  const [solicitudes, setSolicitudes] = useState([]);
  const [pendingStimuli, setPendingStimuli] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStimuli, setLoadingStimuli] = useState(true);
  const [activeTab, setActiveTab] = useState("terapeutas");
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [rejectingId, setRejectingId] = useState(null);

  // Media preview & creator name resolution
  const [expandedId, setExpandedId] = useState(null);
  const [mediaUrls, setMediaUrls] = useState({}); // { stimulusId: { audio, video, image } }
  const [creatorNames, setCreatorNames] = useState({}); // { uid: { nombre, role, id } }

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToSolicitudes((data) => {
      setSolicitudes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setLoadingStimuli(true);
    const unsubscribe = subscribeTEMStimuliPending((data) => {
      setPendingStimuli(data);
      setLoadingStimuli(false);
    });
    return () => unsubscribe();
  }, []);

  // Resolve creator names for pending stimuli
  useEffect(() => {
    const uids = [...new Set(pendingStimuli.map((s) => s.creado_por).filter(Boolean))];
    uids.forEach(async (uid) => {
      if (creatorNames[uid]) return;
      try {
        const info = await getUserDisplayInfo(uid);
        setCreatorNames((prev) => ({ ...prev, [uid]: info }));
      } catch {
        setCreatorNames((prev) => ({ ...prev, [uid]: { nombre: uid, role: "desconocido", id: uid } }));
      }
    });
  }, [pendingStimuli]);

  // Resolve media URLs when a stimulus is expanded
  const handleToggleExpand = async (stimulus) => {
    if (expandedId === stimulus.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(stimulus.id);

    if (mediaUrls[stimulus.id]) return; // already resolved

    const urls = {};
    try {
      if (stimulus.audio_url) urls.audio = await getTEMStorageUrl(stimulus.audio_url);
    } catch { /* ignore */ }
    try {
      if (stimulus.video_url) urls.video = await getTEMStorageUrl(stimulus.video_url);
    } catch { /* ignore */ }
    try {
      if (stimulus.imagen_url) urls.image = await getTEMStorageUrl(stimulus.imagen_url);
    } catch { /* ignore */ }
    setMediaUrls((prev) => ({ ...prev, [stimulus.id]: urls }));
  };

  const handleApprove = async (solicitud) => {
    try {
      await approveSolicitud(solicitud);
    } catch (error) {
      console.error("Error al aprobar la solicitud:", error);
    }
  };

  const handleReject = async (solicitud) => {
    try {
      await rejectSolicitud(solicitud);
    } catch (err) {
      console.error("Error al rechazar la solicitud:", err);
    }
  };

  const handleApproveStimulus = async (stimulusId) => {
    try {
      await approveEstimulo(stimulusId);
      if (expandedId === stimulusId) setExpandedId(null);
    } catch (err) {
      console.error("Error al aprobar estímulo:", err);
    }
  };

  const handleRejectStimulus = async (stimulusId) => {
    try {
      await rejectEstimulo(stimulusId, rejectMotivo);
      setRejectingId(null);
      setRejectMotivo("");
      if (expandedId === stimulusId) setExpandedId(null);
    } catch (err) {
      console.error("Error al rechazar estímulo:", err);
    }
  };

  const filteredSolicitudes = solicitudes.filter((s) =>
    s.email.toLowerCase().includes(filtro.toLowerCase())
  );

  const pendingCount = solicitudes.filter((s) => s.estado === "pendiente").length;
  const pendingStimuliCount = pendingStimuli.length;

  const renderCreatorLink = (uid) => {
    if (!uid) return "—";
    const info = creatorNames[uid];
    if (!info) return <span className="text-muted">Cargando...</span>;
    return (
      <span
        className="creator-link"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/admin/creador/${uid}`);
        }}
        title={`Ver perfil de ${info.nombre}`}
      >
        {info.nombre}
        <span className="creator-role-badge">{info.role}</span>
      </span>
    );
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-left">
          <h1>Panel de Administración</h1>
          <p>Gestión de solicitudes y estímulos</p>
        </div>
        <div className="header-actions">
          <input
            type="text"
            placeholder="🔍 Buscar por correo..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="search-input"
          />
          <button className="btn-admin-logout" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab-btn ${activeTab === "terapeutas" ? "active" : ""}`}
          onClick={() => setActiveTab("terapeutas")}
        >
          Terapeutas
          {pendingCount > 0 && <span className="admin-tab-badge">{pendingCount}</span>}
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "estimulos" ? "active" : ""}`}
          onClick={() => setActiveTab("estimulos")}
        >
          Estímulos TEM
          {pendingStimuliCount > 0 && <span className="admin-tab-badge">{pendingStimuliCount}</span>}
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "ejercicios" ? "active" : ""}`}
          onClick={() => setActiveTab("ejercicios")}
        >
          Ejercicios
        </button>
      </div>

      {/* Tab: Terapeutas */}
      {activeTab === "terapeutas" && (
        <>
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Cargando solicitudes...</p>
            </div>
          ) : (
            <>
              <section>
                <h2 className="section-title">Pendientes</h2>
                {filteredSolicitudes.filter((s) => s.estado === "pendiente").length === 0 ? (
                  <p className="empty-text">No hay solicitudes pendientes.</p>
                ) : (
                  <div className="solicitudes-grid">
                    {filteredSolicitudes
                      .filter((s) => s.estado === "pendiente")
                      .map((s) => (
                        <div className="solicitud-card fade-in" key={s.id}>
                          <div className="card-header">
                            <h3>{s.nombre}</h3>
                            <span className="tag pending">Pendiente</span>
                          </div>
                          <p><strong>Email:</strong> {s.email}</p>
                          <p><strong>Profesión:</strong> {s.profesion}</p>
                          <p className="motivation"><strong>Motivación:</strong> {s.motivacion}</p>
                          <div className="btn-group">
                            <button onClick={() => handleApprove(s)} className="btn btn-approve">Aprobar</button>
                            <button onClick={() => handleReject(s)} className="btn btn-reject">Rechazar</button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="section-title">Completadas</h2>
                {filteredSolicitudes.filter((s) => s.estado !== "pendiente").length === 0 ? (
                  <p className="empty-text">Aún no hay solicitudes procesadas.</p>
                ) : (
                  <div className="solicitudes-grid">
                    {filteredSolicitudes
                      .filter((s) => s.estado !== "pendiente")
                      .map((s) => (
                        <div className="solicitud-card complete fade-in" key={s.id}>
                          <div className="card-header">
                            <h3>{s.nombre}</h3>
                            <span className={`tag ${s.estado === "aprobada" ? "approved" : "rejected"}`}>
                              {s.estado}
                            </span>
                          </div>
                          <p><strong>Email:</strong> {s.email}</p>
                          <p><strong>Profesión:</strong> {s.profesion || "—"}</p>
                        </div>
                      ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {/* Tab: Estímulos TEM pendientes */}
      {activeTab === "estimulos" && (
        <>
          {loadingStimuli ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Cargando estímulos pendientes...</p>
            </div>
          ) : pendingStimuli.length === 0 ? (
            <p className="empty-text">No hay estímulos pendientes de revisión.</p>
          ) : (
            <div className="stimuli-review-list">
              {pendingStimuli.map((s) => {
                const isExpanded = expandedId === s.id;
                const urls = mediaUrls[s.id] || {};
                return (
                  <div className={`stimulus-review-card fade-in ${isExpanded ? "expanded" : ""}`} key={s.id}>
                    {/* Collapsed summary — always visible */}
                    <div className="stimulus-summary" onClick={() => handleToggleExpand(s)}>
                      <div className="summary-left">
                        <h3>{s.texto}</h3>
                        <div className="summary-meta">
                          <span className="tag pending">Pendiente</span>
                          <span>Nivel {s.nivel_clinico}</span>
                          <span>{s.num_silabas} sílabas</span>
                          <span>{s.categoria || "—"}</span>
                        </div>
                      </div>
                      <div className="summary-right">
                        <span className="summary-creator">
                          {renderCreatorLink(s.creado_por)}
                        </span>
                        <span className="expand-icon">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="stimulus-detail">
                        <div className="detail-grid">
                          <div className="detail-info">
                            <p><strong>Patrón tonal:</strong> {s.patron_tonal || "—"}</p>
                            <p><strong>Pregunta:</strong> {s.pregunta || "—"}</p>
                            <p><strong>Fecha:</strong> {s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString() : "—"}</p>
                            {s.syllables && s.syllables.length > 0 && (
                              <div className="detail-syllables">
                                <strong>Sílabas:</strong>
                                <div className="syllable-chips">
                                  {s.syllables.map((syl, i) => (
                                    <span key={i} className="syllable-chip">{typeof syl === "string" ? syl : syl.text || JSON.stringify(syl)}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="detail-media">
                            {/* Audio */}
                            {s.audio_url && (
                              <div className="media-block">
                                <label>🔊 Audio de referencia</label>
                                {urls.audio ? (
                                  <audio controls preload="none"><source src={urls.audio} type="audio/mpeg" /></audio>
                                ) : (
                                  <span className="text-muted">Cargando audio...</span>
                                )}
                              </div>
                            )}

                            {/* Video */}
                            {s.video_url && (
                              <div className="media-block">
                                <label>🎥 Video articulatorio</label>
                                {urls.video ? (
                                  <video controls preload="none" style={{ maxWidth: "100%", borderRadius: "0.5rem" }}>
                                    <source src={urls.video} type="video/webm" />
                                  </video>
                                ) : (
                                  <span className="text-muted">Cargando video...</span>
                                )}
                              </div>
                            )}

                            {/* Image */}
                            {s.imagen_url && (
                              <div className="media-block">
                                <label>🖼️ Imagen asociada</label>
                                {urls.image ? (
                                  <img src={urls.image} alt={s.texto} style={{ maxWidth: "100%", borderRadius: "0.5rem" }} />
                                ) : (
                                  <span className="text-muted">Cargando imagen...</span>
                                )}
                              </div>
                            )}

                            {!s.audio_url && !s.video_url && !s.imagen_url && (
                              <p className="text-muted">Sin archivos multimedia adjuntos.</p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {rejectingId === s.id ? (
                          <div className="reject-form">
                            <textarea
                              placeholder="Motivo del rechazo (opcional)"
                              value={rejectMotivo}
                              onChange={(e) => setRejectMotivo(e.target.value)}
                              rows={2}
                              className="reject-textarea"
                            />
                            <div className="btn-group">
                              <button onClick={() => handleRejectStimulus(s.id)} className="btn btn-reject">Confirmar rechazo</button>
                              <button onClick={() => { setRejectingId(null); setRejectMotivo(""); }} className="btn btn-secondary">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="btn-group">
                            <button onClick={() => handleApproveStimulus(s.id)} className="btn btn-approve">Aprobar</button>
                            <button onClick={() => setRejectingId(s.id)} className="btn btn-reject">Rechazar</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab: Ejercicios */}
      {activeTab === "ejercicios" && <AdminExercises />}
    </div>
  );
};

export default AdminDashboard;
