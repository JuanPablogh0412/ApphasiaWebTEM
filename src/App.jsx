// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TerapeutaLogin from "./components/login/TerapeutaLogin";
import DashboardTerapeuta from "./components/dashboard/DashboardTerapeuta";
import PacientesTerapeuta from "./components/patients/PacientesTerapeuta";
import EjerciciosTerapeuta from "./components/exercises/EjerciciosTerapeuta";
import SelectExerciseType from "./components/addExercise/SelectExerciseType";
import AddExerciseIA from "./components/addExercise/AddExerciseIA";
import PacienteDetail from "./components/patients/PacienteDetail";
import TerapeutaRegistro from "./components/login/TerapeutaRegistro";
import CreadorRegistro from "./components/login/CreadorRegistro";
import CreadorDashboard from "./components/creador/CreadorDashboard";
import CreadorProfile from "./components/admin/CreadorProfile";
import AddTEMStimulus from "./components/addExercise/AddTEMStimulus";
import MobileRecorder from "./components/recording/MobileRecorder";
import ProtectedRoute from "./components/common/ProtectedRoute";

// 🔹 nuevos componentes del admin

import AdminDashboard from "./components/admin/AdminDashboard";

function App() {
  return (
    <Routes>
      {/* === PÚBLICAS === */}
      <Route path="/" element={<TerapeutaLogin />} />
      <Route path="/registro" element={<TerapeutaRegistro />} />
      <Route path="/registro-creador" element={<CreadorRegistro />} />
      <Route path="/grabar/:token" element={<MobileRecorder />} />

      {/* === TERAPEUTA (protegidas) === */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["terapeuta"]}><DashboardTerapeuta /></ProtectedRoute>} />
      <Route path="/pacientes" element={<ProtectedRoute allowedRoles={["terapeuta"]}><PacientesTerapeuta /></ProtectedRoute>} />
      <Route path="/pacientes/:pacienteId" element={<ProtectedRoute allowedRoles={["terapeuta"]}><PacienteDetail /></ProtectedRoute>} />
      <Route path="/ejercicios" element={<ProtectedRoute allowedRoles={["terapeuta"]}><EjerciciosTerapeuta /></ProtectedRoute>} />
      <Route path="/ejercicios/nuevo" element={<ProtectedRoute allowedRoles={["terapeuta"]}><SelectExerciseType /></ProtectedRoute>} />
      <Route path="/ejercicios/nuevo/ia" element={<ProtectedRoute allowedRoles={["terapeuta"]}><AddExerciseIA /></ProtectedRoute>} />
      <Route path="/ejercicios/nuevo-tem" element={<ProtectedRoute allowedRoles={["terapeuta"]}><AddTEMStimulus /></ProtectedRoute>} />

      {/* === ADMIN (protegida) === */}
      <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/creador/:uid" element={<ProtectedRoute allowedRoles={["admin"]}><CreadorProfile /></ProtectedRoute>} />

      {/* === CREADOR (protegidas) === */}
      <Route path="/creador/dashboard" element={<ProtectedRoute allowedRoles={["creador"]}><CreadorDashboard /></ProtectedRoute>} />
      <Route path="/creador/ejercicios/nuevo-tem" element={<ProtectedRoute allowedRoles={["creador"]}><AddTEMStimulus /></ProtectedRoute>} />

      {/* === DEFAULT === */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
