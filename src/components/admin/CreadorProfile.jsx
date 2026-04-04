import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserDisplayInfo } from "../../services/therapistService";
import { subscribeTEMStimuliByCreator, getTEMStorageUrl } from "../../services/temService";
import TEMStimulusModal from "../exercises/TEMStimulusModal";
import "../admin/Admin.css";

const CreadorProfile = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [creador, setCreador] = useState(null);
  const [stimuli, setStimuli] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStimulus, setSelectedStimulus] = useState(null);

  useEffect(() => {
    getUserDisplayInfo(uid)
      .then(setCreador)
      .catch(() => setCreador({ nombre: uid, role: "desconocido" }));
  }, [uid]);

  useEffect(() => {
    const unsub = subscribeTEMStimuliByCreator(uid, (data) => {
      setStimuli(data);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const estadoBadge = (estado) => {
    switch (estado) {
      case "aprobado": return <span className="tag approved">Aprobado</span>;
      case "pendiente_revision": return <span className="tag pending">Pendiente</span>;
      case "rechazado": return <span className="tag rejected">Rechazado</span>;
      default: return <span className="tag">{estado || "—"}</span>;
    }
  };

  const approvedCount = stimuli.filter(s => s.estado === "aprobado").length;
  const pendingCount = stimuli.filter(s => s.estado === "pendiente_revision").length;
  const rejectedCount = stimuli.filter(s => s.estado === "rechazado").length;

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-left">
          <button
            onClick={() => navigate("/admin/dashboard")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--primary-dark)", fontWeight: 600, fontSize: "0.9rem",
              marginBottom: "0.5rem", padding: 0,
            }}
          >
            ← Volver al panel
          </button>
          <h1>{creador?.nombre || "Cargando..."}</h1>
          <p>
            Perfil de {creador?.role || "usuario"} · {creador?.email || ""}
            {creador?.profesion && ` · ${creador.profesion}`}
            {creador?.celular && ` · ${creador.celular}`}
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="solicitudes-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="solicitud-card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--primary)", fontSize: "2rem", margin: 0 }}>{stimuli.length}</h3>
          <p style={{ margin: 0, color: "var(--muted)" }}>Total estímulos</p>
        </div>
        <div className="solicitud-card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "#0ba84c", fontSize: "2rem", margin: 0 }}>{approvedCount}</h3>
          <p style={{ margin: 0, color: "var(--muted)" }}>Aprobados</p>
        </div>
        <div className="solicitud-card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "#ffb700", fontSize: "2rem", margin: 0 }}>{pendingCount}</h3>
          <p style={{ margin: 0, color: "var(--muted)" }}>Pendientes</p>
        </div>
        <div className="solicitud-card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "#d13a3a", fontSize: "2rem", margin: 0 }}>{rejectedCount}</h3>
          <p style={{ margin: 0, color: "var(--muted)" }}>Rechazados</p>
        </div>
      </div>

      <h2 className="section-title">Estímulos creados</h2>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando estímulos...</p>
        </div>
      ) : stimuli.length === 0 ? (
        <p className="empty-text">Este usuario no ha creado estímulos.</p>
      ) : (
        <div className="solicitudes-grid">
          {stimuli.map((s) => (
            <div
              className="solicitud-card fade-in"
              key={s.id}
              onClick={() => setSelectedStimulus(s)}
              style={{ cursor: "pointer" }}
            >
              <div className="card-header">
                <h3>{s.texto}</h3>
                {estadoBadge(s.estado)}
              </div>
              <p><strong>Nivel:</strong> {s.nivel_clinico}</p>
              <p><strong>Sílabas:</strong> {s.num_silabas}</p>
              <p><strong>Categoría:</strong> {s.categoria || "—"}</p>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                {s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString() : "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedStimulus && (
        <TEMStimulusModal
          stimulus={selectedStimulus}
          onClose={() => setSelectedStimulus(null)}
        />
      )}
    </div>
  );
};

export default CreadorProfile;
