import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  subscribeTEMStimuliByCreator,
  subscribeTEMStimuliApproved,
} from "../../services/temService";
import TEMTable from "../exercises/TEMTable";
import TEMStimulusModal from "../exercises/TEMStimulusModal";
import Navbar from "../common/Navbar";
import "./CreadorDashboard.css";

const CreadorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myStimuli, setMyStimuli] = useState([]);
  const [approvedStimuli, setApprovedStimuli] = useState([]);
  const [activeTab, setActiveTab] = useState("mis-estimulos");
  const [selectedStimulus, setSelectedStimulus] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsub1 = subscribeTEMStimuliByCreator(user.uid, (data) => {
      setMyStimuli(data);
      setLoading(false);
    });

    const unsub2 = subscribeTEMStimuliApproved((data) => {
      setApprovedStimuli(data);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  const handleView = async (stimulus) => {
    setSelectedStimulus(stimulus);
    setShowModal(true);
  };

  const estadoBadge = (estado) => {
    switch (estado) {
      case "aprobado":
        return <span className="estado-tag approved">Aprobado</span>;
      case "pendiente_revision":
        return <span className="estado-tag pending">Pendiente</span>;
      case "rechazado":
        return <span className="estado-tag rejected">Rechazado</span>;
      default:
        return <span className="estado-tag">{estado || "—"}</span>;
    }
  };

  const pendingCount = myStimuli.filter(
    (s) => s.estado === "pendiente_revision"
  ).length;
  const approvedCount = myStimuli.filter(
    (s) => s.estado === "aprobado"
  ).length;
  const rejectedCount = myStimuli.filter(
    (s) => s.estado === "rechazado"
  ).length;

  return (
    <>
      <Navbar active="creador/dashboard" />

      <div className="creador-page">
        {/* Header */}
        <div className="creador-header">
          <div>
            <h2>
              Bienvenido, <span className="accent">{user?.displayName || "Creador"}</span>
            </h2>
            <p className="subtitle">Panel de creación de estímulos TEM</p>
          </div>
          <button
            className="btn-nuevo-estimulo"
            onClick={() => navigate("/creador/ejercicios/nuevo-tem")}
          >
            + Nuevo Estímulo
          </button>
        </div>

        {/* Stats Cards */}
        <div className="creador-stats">
          <div className="stat-card">
            <div className="stat-icon-wrap orange">
              <span className="stat-icon">📋</span>
            </div>
            <div>
              <div className="stat-number">{myStimuli.length}</div>
              <div className="stat-label">Total creados</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap yellow">
              <span className="stat-icon">⏳</span>
            </div>
            <div>
              <div className="stat-number pending">{pendingCount}</div>
              <div className="stat-label">Pendientes</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap green">
              <span className="stat-icon">✅</span>
            </div>
            <div>
              <div className="stat-number approved">{approvedCount}</div>
              <div className="stat-label">Aprobados</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap red">
              <span className="stat-icon">❌</span>
            </div>
            <div>
              <div className="stat-number rejected">{rejectedCount}</div>
              <div className="stat-label">Rechazados</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="terapia-tabs">
          <button
            className={`tab-btn ${activeTab === "mis-estimulos" ? "active-tab" : ""}`}
            onClick={() => setActiveTab("mis-estimulos")}
          >
            Mis Estímulos
            {pendingCount > 0 && (
              <span className="tab-count">{pendingCount}</span>
            )}
          </button>
          <button
            className={`tab-btn ${activeTab === "catalogo" ? "active-tab" : ""}`}
            onClick={() => setActiveTab("catalogo")}
          >
            Catálogo Aprobado
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Cargando estímulos...</p>
          </div>
        ) : (
          <>
            {activeTab === "mis-estimulos" && (
              <section>
                {myStimuli.length === 0 ? (
                  <div className="empty-state">
                    <p>Aún no has creado estímulos.</p>
                    <button
                      className="btn-nuevo-estimulo"
                      onClick={() => navigate("/creador/ejercicios/nuevo-tem")}
                    >
                      Crear mi primer estímulo
                    </button>
                  </div>
                ) : (
                  <div className="stimuli-grid">
                    {myStimuli.map((s) => (
                      <div
                        className="stimulus-card"
                        key={s.id}
                        onClick={() => handleView(s)}
                      >
                        <div className="stimulus-card-header">
                          <h4>{s.texto}</h4>
                          {estadoBadge(s.estado)}
                        </div>
                        <div className="stimulus-meta">
                          <span>Nivel {s.nivel_clinico}</span>
                          <span>{s.num_silabas} sílabas</span>
                          <span>{s.categoria || "—"}</span>
                        </div>
                        {s.estado === "rechazado" && s.motivoRechazo && (
                          <div className="rejection-reason">
                            <strong>Motivo:</strong> {s.motivoRechazo}
                          </div>
                        )}
                        <p className="stimulus-date">
                          {s.fecha_creacion
                            ? new Date(s.fecha_creacion).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === "catalogo" && (
              <TEMTable stimuli={approvedStimuli} onView={handleView} />
            )}
          </>
        )}

        {/* Modal */}
        {showModal && selectedStimulus && (
          <TEMStimulusModal
            stimulus={selectedStimulus}
            onClose={() => {
              setShowModal(false);
              setSelectedStimulus(null);
            }}
          />
        )}
      </div>
    </>
  );
};

export default CreadorDashboard;
