import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Navbar from "../common/Navbar";
import { getAssignedExercises, getPatientById } from "../../services/patientService";
import { getExerciseDetails, getExerciseById } from "../../services/exercisesService";
import VNESTExerciseModal from "../exercises/VNESTExerciseModal";
import SRExerciseModal from "../exercises/SRExerciseModal";
import PacientePersonalizar from "./PacientePersonalizar";
import PatientAssignExercise from "./PatientAssignExercise";
import PacienteVNEST from "./PacienteVNEST";
import PacienteSR from "./PacienteSR";
import PacienteTEM from "./PacienteTEM";
import PatientProfile from "./PatientProfile";
import TemSessionDetail from "./TemSessionDetail";
import TemAnalysisDetail from "./TemAnalysisDetail";
import { subscribePatientTEMSessions } from "../../services/temService";
import { useAuth } from "../../context/AuthContext";
import "./PacienteDetail.css";

const PacienteDetail = () => {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useAuth();
  const [patientInfo, setPatientInfo] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [detailedExercises, setDetailedExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showVnestViewer, setShowVnestViewer] = useState(false);
  const [showSRViewer, setShowSRViewer] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false);

  // Leer tab inicial desde query param ?tab=perfil|TEM|SR|VNEST
  const initialTab = (() => {
    const params = new URLSearchParams(location.search);
    const t = params.get("tab")?.toUpperCase();
    if (t === "PERFIL") return "PERFIL";
    if (t === "TEM") return "TEM";
    if (t === "SR") return "SR";
    return "VNEST";
  })();

  const [activeTerapia, setActiveTerapia] = useState(initialTab);
  const [temSessions, setTemSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [overrideData, setOverrideData] = useState(null);
  const [message] = useState("");

  // 📄 Cargar ejercicios asignados al paciente
  useEffect(() => {
    if (!pacienteId) return;
    const unsubscribe = getAssignedExercises(pacienteId, setExercises);
    return () => unsubscribe && unsubscribe();
  }, [pacienteId]);

  // 🎵 Cargar sesiones TEM del paciente
  useEffect(() => {
    if (!pacienteId) return;
    const unsubscribe = subscribePatientTEMSessions(pacienteId, setTemSessions);
    return () => unsubscribe && unsubscribe();
  }, [pacienteId]);

  //cargar info del paciente + verificar ownership
  useEffect(() => {
    const loadPatientInfo = async () => {
      if (!pacienteId || !user) return;

      try {
        const info = await getPatientById(pacienteId);
        if (!info) { navigate("/pacientes"); return; }

        // Ownership check: solo el terapeuta asignado o admin
        if (role === "terapeuta" && info.terapeuta !== user.uid) {
          navigate("/pacientes");
          return;
        }

        setPatientInfo(info);
      } catch (error) {
        navigate("/pacientes");
      }
    };

    loadPatientInfo();
  }, [pacienteId, user, role, navigate]);

  // 🔍 Cargar detalles de cada ejercicio
  useEffect(() => {
    const loadDetails = async () => {
      if (exercises.length === 0) {
        setDetailedExercises([]);
        return;
      }

      try {
        const detailed = await Promise.all(
          exercises.map(async (e) => {
            const id = e.id_ejercicio || e.id;
            if (!id) return e;

            try {
              const meta = await getExerciseById(id);
              if (!meta) return e;

              const terapia = meta.terapia || e.terapia;
              let extra = {};
              if (terapia) {
                extra = await getExerciseDetails(id, terapia);
              }

              return { ...meta, ...extra, ...e };
            } catch (err) {
                    return e;
            }
          })
        );

        // 🔹 Ordenar por fecha
        detailed.sort((a, b) => {
          const fechaA = a.fecha_asignacion?.seconds || 0;
          const fechaB = b.fecha_asignacion?.seconds || 0;
          return fechaB - fechaA;
        });

        setDetailedExercises(detailed);
      } catch (error) {
      }
    };
    loadDetails();
  }, [exercises]);

  const handleViewExercise = async (exercise) => {
      try {
        setSelectedExercise(null);
  
        const extras = await getExerciseDetails(exercise.id, exercise.terapia);
        const extra =
          Array.isArray(extras) && extras.length > 0 ? extras[0] : extras || {};
  
        setSelectedExercise({ ...exercise, ...extra });
  
        // 👇 abrir el modal adecuado según la terapia
        if (exercise.terapia === "VNEST") setShowVnestViewer(true);
        else if (exercise.terapia === "SR") setShowSRViewer(true);
      } catch (err) {
      }
    };

  return (
    <div className="page-container paciente-page">
      <Navbar active="pacientes" />

      <main className="container py-5 mt-5">
        {/* === HEADER === */}
        <div className="paciente-header">
          <h2>Ejercicios de {patientInfo?.nombre || "Paciente"}</h2>
          <div className="actions">
            <button
              className="btn-secondary"
              onClick={() => setShowPersonalizeModal(true)}
            >
              ✨ Crear Ejercicio Personalizado
            </button>
            <button
              className="btn-primary"
              onClick={() => setShowModal(true)}
            >
              + Asignar Ejercicio
            </button>
          </div>
        </div>

        {/* --- FILTRO DE TERAPIAS --- */}
        <div className="terapia-tabs mb-4">
          {["VNEST", "SR", "TEM", "PERFIL"].map((terapia) => (
            <button
              key={terapia}
              className={`tab-btn ${
                activeTerapia === terapia ? "active-tab" : ""
              }`}
              onClick={() => setActiveTerapia(terapia)}
            >
              {terapia === "PERFIL" ? "👤 Perfil" : terapia}
            </button>
          ))}
        </div>

        {/* === TABLA SEGÚN TERAPIA === */}
        {activeTerapia === "VNEST" ? (
          <PacienteVNEST
            exercises={detailedExercises.filter((e) => e.terapia === "VNEST")}
            onView={handleViewExercise}
          />
        ) : activeTerapia === "SR" ? (
          <PacienteSR
            exercises={detailedExercises.filter((e) => e.terapia === "SR")}
            onView={handleViewExercise}
          />
        ) : activeTerapia === "TEM" ? (
          <PacienteTEM
            sessions={temSessions}
            onViewSession={(s) => {
              setSelectedSession(s);
              setShowSessionDetail(true);
            }}
            pacienteId={pacienteId}
            patientInfo={patientInfo}
            onNivelChanged={(nuevoNivel) =>
              setPatientInfo((prev) => prev ? { ...prev, nivel_actual: nuevoNivel } : prev)
            }
          />
        ) : (
          <PatientProfile
            patientInfo={patientInfo}
            pacienteId={pacienteId}
            onSwitchToTEM={() => setActiveTerapia("TEM")}
            onNivelChanged={(nuevoNivel) =>
              setPatientInfo((prev) => prev ? { ...prev, nivel_actual: nuevoNivel } : prev)
            }
          />
        )}

        {message && <div className="alert-msg fade-in">{message}</div>}

        {/* === MODALES === */}
        {showModal && (
          <PatientAssignExercise
            open={showModal}
            onClose={() => setShowModal(false)}
            patientId={pacienteId}
          />
        )}

        {showPersonalizeModal && (
          <PacientePersonalizar
            open={showPersonalizeModal}
            onClose={() => setShowPersonalizeModal(false)}
            pacienteId={pacienteId}
          />
        )}

        {showVnestViewer && selectedExercise && (
          <VNESTExerciseModal
            exercise={selectedExercise}
            onClose={() => {
              setShowVnestViewer(false);
              setSelectedExercise(null);
            }}
          />
        )}

        {showSRViewer && selectedExercise && (
          <SRExerciseModal
            exercise={selectedExercise}
            onClose={() => {
              setShowSRViewer(false);
              setSelectedExercise(null);
            }}
          />
        )}

        {showSessionDetail && selectedSession && (
          <TemSessionDetail
            session={selectedSession}
            patientId={pacienteId}
            onClose={() => {
              setShowSessionDetail(false);
              setSelectedSession(null);
            }}
            onOverride={(data) => setOverrideData(data)}
          />
        )}

        {overrideData && (
          <TemAnalysisDetail
            data={overrideData}
            onClose={() => setOverrideData(null)}
            onSaved={() => {
              setOverrideData(null);
              // Refrescar la sesión cerrando y reabriendo
              setShowSessionDetail(false);
              setTimeout(() => setShowSessionDetail(true), 100);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default PacienteDetail;
