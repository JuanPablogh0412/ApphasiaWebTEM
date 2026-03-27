# Arquitectura de Software — RehabilitIA Web App
### Modelo de Vistas 4+1 (Philippe Kruchten)

> **Sistema:** Web-App-RehabilitIA  
> **Versión analizada:** 0.0.0  
> **Stack:** React 19 + Vite · Firebase (Auth, Firestore, Functions) · API REST externa · Docker + Nginx  
> **Fecha:** Marzo 2026

---

## Contenido

1. [Vista de Casos de Uso (+1)](#1-vista-de-casos-de-uso-1)
2. [Vista Lógica](#2-vista-lógica)
3. [Vista de Desarrollo](#3-vista-de-desarrollo)
4. [Vista de Procesos](#4-vista-de-procesos)
5. [Vista Física](#5-vista-física)
6. [Resumen de Decisiones Arquitectónicas](#6-resumen-de-decisiones-arquitectónicas)
7. [Diagrama Lógico MVVM](#7-diagrama-lógico-mvvm)

---

## 1. Vista de Casos de Uso (+1)

> Esta es la vista central del modelo 4+1. Define **quién** usa el sistema y **qué** hace. Las demás vistas se justifican a partir de aquí.

### 1.1 Actores

| Actor | Descripción |
|---|---|
| **Terapeuta** | Profesional de salud que gestiona pacientes y ejercicios terapéuticos |
| **Administrador** | Rol especial (credenciales fijas) que aprueba o rechaza solicitudes de registro |
| **Sistema IA** | API externa que genera y personaliza ejercicios automáticamente |
| **Firebase** | Plataforma que provee autenticación, base de datos y funciones serverless |

### 1.2 Casos de Uso Principales

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SISTEMA RehabilitIA                         │
│                                                                     │
│  TERAPEUTA                                                          │
│  ─────────                                                          │
│  UC-01  Iniciar sesión                                              │
│  UC-02  Solicitar registro (nuevo terapeuta)                        │
│  UC-03  Ver dashboard con estadísticas en tiempo real               │
│  UC-04  Gestionar lista de pacientes                                │
│  UC-05  Ver detalle de un paciente                                  │
│  UC-06  Agregar nuevo paciente                                      │
│  UC-07  Asignar ejercicio a un paciente                             │
│  UC-08  Personalizar ejercicio para un paciente (con IA)            │
│  UC-09  Ver ejercicios VNEST y SR de un paciente                    │
│  UC-10  Explorar biblioteca de ejercicios                           │
│  UC-11  Crear ejercicio VNEST con IA                                │
│  UC-12  Editar ejercicio existente (VNEST / SR)                     │
│  UC-13  Eliminar ejercicio                                          │
│  UC-14  Restablecer contraseña                                      │
│                                                                     │
│  ADMINISTRADOR                                                      │
│  ──────────────                                                     │
│  UC-15  Iniciar sesión como administrador                           │
│  UC-16  Ver solicitudes de registro de terapeutas                   │
│  UC-17  Aprobar solicitud (invoca Cloud Function)                   │
│  UC-18  Rechazar solicitud (invoca Cloud Function)                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Flujo narrativo principal (UC-11: Crear ejercicio con IA)

```
Terapeuta → selecciona contexto y nivel
         → presiona "Generar"
         → exercisesService llama a POST /api/context/generate
         → API externa (IA) procesa y retorna ejercicio VNEST
         → ejercicio queda guardado en Firestore
         → Terapeuta lo asigna a un paciente (UC-07)
```

---

## 2. Vista Lógica

> Describe la **descomposición funcional** del sistema en capas y módulos. Orientada a los desarrolladores que entienden la estructura del negocio.

### 2.1 Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAPA DE PRESENTACIÓN                         │
│                     (React Components / JSX)                        │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │  Login   │  │Dashboard │  │ Pacientes │  │    Ejercicios     │  │
│  │  Módulo  │  │ Módulo   │  │  Módulo   │  │     Módulo        │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────────┘  │
│                                             ┌───────────────────┐  │
│  ┌──────────┐                               │   Admin Módulo    │  │
│  │ Common   │  (Navbar, Footer)             └───────────────────┘  │
│  └──────────┘                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                       CAPA DE SERVICIOS                              │
│                   (src/services/*.js)                               │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ therapistService │  │  patientService  │  │exercisesService  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │  adminService    │  │ contextService   │                        │
│  └──────────────────┘  └──────────────────┘                        │
├─────────────────────────────────────────────────────────────────────┤
│                   CAPA DE INTEGRACIÓN EXTERNA                        │
│                                                                      │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │      Firebase SDK            │  │   API REST Externa (IA)      │ │
│  │  Auth · Firestore · Functions│  │  afasia.virtual.uniandes.edu │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Módulos de la Capa de Presentación

#### Módulo `login/`
| Componente | Responsabilidad |
|---|---|
| `TerapeutaLogin` | Formulario de login, redirige a `/dashboard` o `/admin/dashboard` |
| `TerapeutaRegistro` | Formulario de solicitud de registro, escribe en colección `solicitudes` |

#### Módulo `dashboard/`
| Componente | Responsabilidad |
|---|---|
| `DashboardTerapeuta` | Muestra bienvenida, contador de pacientes y ejercicios pendientes en tiempo real |

#### Módulo `patients/`
| Componente | Responsabilidad |
|---|---|
| `PacientesTerapeuta` | Lista paginada de pacientes del terapeuta con suscripción en tiempo real |
| `PacienteDetail` | Vista completa del paciente: ejercicios asignados VNEST y SR |
| `PacientePersonalizar` | Modal para personalizar un ejercicio con IA para ese paciente |
| `PatientAssignExercise` | Modal para asignar un ejercicio de la biblioteca al paciente |
| `PacienteVNEST` | Vista específica de progreso de ejercicios VNEST |
| `PacienteSR` | Vista específica de progreso de ejercicios SR |

#### Módulo `exercises/`
| Componente | Responsabilidad |
|---|---|
| `EjerciciosTerapeuta` | Biblioteca de ejercicios VNEST y SR visibles para el terapeuta |
| `VNESTTable` | Tabla de ejercicios VNEST con opciones editar/eliminar |
| `SRTable` | Tabla de ejercicios SR con opciones editar/eliminar |
| `VNESTExerciseModal` | Modal para ver detalles de un ejercicio VNEST |
| `SRExerciseModal` | Modal para ver detalles de un ejercicio SR |

#### Módulo `addExercise/`
| Componente | Responsabilidad |
|---|---|
| `SelectExerciseType` | Pantalla para elegir entre creación manual o con IA |
| `AddExerciseIA` | Formulario + llamada a la API de IA para generar ejercicio VNEST |

#### Módulo `editExercises/`
| Componente | Responsabilidad |
|---|---|
| `VNESTEditor` | Formulario de edición de ejercicio VNEST existente |
| `SREditor` | Formulario de edición de ejercicio SR existente |

#### Módulo `admin/`
| Componente | Responsabilidad |
|---|---|
| `AdminDashboard` | Panel de solicitudes pendientes de nuevos terapeutas |

#### Módulo `common/`
| Componente | Responsabilidad |
|---|---|
| `Navbar` | Barra de navegación superior con estado activo por ruta |
| `Footer` | Pie de página |

### 2.3 Módulos de la Capa de Servicios

| Servicio | Funciones principales | Backend usado |
|---|---|---|
| `firebase.js` | Inicializa `db`, `auth`, `functions` | Firebase SDK |
| `therapistService.js` | `loginUnified`, `loginTherapist`, `getTherapistData`, `sendTherapistRequest`, `subscribeAssignedPatients`, `subscribePendingVisibleExercises`, `resetTherapistPassword` | Firebase Auth + Firestore |
| `patientService.js` | `getPatientById`, `getPatientByEmail`, `updatePatient`, `assignPatientToTherapist`, `assignExerciseToPatient`, `getAssignedExercises` | Firestore |
| `exercisesService.js` | `getAllExercises`, `getVisibleExercises`, `getExerciseById`, `getExerciseDetails`, `deleteExercise`, `updateExercise`, `generateExercise`, `personalizeExercise` | Firestore + API REST |
| `adminService.js` | `authAdmin`, `getSolicitudes`, `approveSolicitud`, `rejectSolicitud` | Firestore + Firebase Functions |
| `contextService.js` | `getAllContexts` | Firestore |

### 2.4 Modelo de Dominio (Colecciones Firestore)

```
┌───────────────────────────────────────────────────────────────────┐
│                     MODELO DE DATOS FIRESTORE                     │
│                                                                   │
│  terapeutas/{uid}                 solicitudes/{id}               │
│  ┌─────────────────────┐          ┌─────────────────────┐        │
│  │ nombre              │          │ nombre              │        │
│  │ email               │          │ email               │        │
│  │ profesion           │          │ profesion           │        │
│  │ celular             │          │ motivacion          │        │
│  │ pacientes: [ids...] │          │ estado              │        │
│  └────────┬────────────┘          │ fecha               │        │
│           │                       └─────────────────────┘        │
│           │ 1:N                                                   │
│           ▼                                                       │
│  pacientes/{id}                                                   │
│  ┌─────────────────────┐                                         │
│  │ nombre              │                                         │
│  │ email               │                                         │
│  │ terapeuta (uid)     │                                         │
│  │ perfil              │                                         │
│  │                     │                                         │
│  └────────┬────────────┘                                         │
│           │ subcolección                                          │
│           ▼                                                       │
│  pacientes/{id}/ejercicios_asignados/{ejercicioId}               │
│  ┌─────────────────────┐                                         │
│  │ id_ejercicio        │                                         │
│  │ tipo (VNEST/SR)     │                                         │
│  │ estado              │                                         │
│  │ prioridad           │                                         │
│  │ veces_realizado     │                                         │
│  │ ultima_fecha        │                                         │
│  │ personalizado       │                                         │
│  └─────────────────────┘                                         │
│                                                                   │
│  ejercicios/{id}          ejercicios_VNEST/{id}                  │
│  ┌──────────────────┐     ┌──────────────────────┐               │
│  │ titulo           │     │ verbo                │               │
│  │ terapia (VNEST   │◄────│ oraciones            │               │
│  │         o SR)    │     │ contexto             │               │
│  │ nivel            │     │ preguntas            │               │
│  │ tipo (publico/   │     └──────────────────────┘               │
│  │       privado)   │                                            │
│  │ creado_por (uid) │     ejercicios_SR/{id}                     │
│  │ revisado         │     ┌──────────────────────┐               │
│  │ personalizado    │◄────│ oraciones            │               │
│  └──────────────────┘     │ contexto             │               │
│                           └──────────────────────┘               │
│                                                                   │
│  contextos/{id}                                                   │
│  ┌─────────────────────┐                                         │
│  │ context (texto)     │                                         │
│  └─────────────────────┘                                         │
└───────────────────────────────────────────────────────────────────┘
```

### 2.5 Visibilidad de Ejercicios (Regla de Negocio Central)

```
Un ejercicio es VISIBLE para un terapeuta si:
  ├── tipo == "publico"                          → siempre visible
  ├── tipo == "privado" && creado_por == uid     → visible (lo creó él)
  └── tipo == "privado" && id_paciente ∈ [ids
       de los pacientes del terapeuta]           → visible (asignado a su paciente)
```

---

## 3. Vista de Desarrollo

> Describe la **estructura estática del código fuente**: cómo están organizados los archivos, módulos y dependencias entre ellos.

### 3.1 Árbol de Directorios Anotado

```
Web-App-RehabilitIA/
│
├── src/                          # Todo el código fuente React
│   ├── main.jsx                  # Punto de entrada · monta <App> en el DOM
│   ├── App.jsx                   # Router principal (React Router DOM)
│   ├── App.css / index.css       # Estilos globales
│   │
│   ├── components/               # Componentes de UI
│   │   ├── common/               # Reutilizables (Navbar, Footer)
│   │   ├── login/                # Autenticación y registro
│   │   ├── dashboard/            # Vista resumen del terapeuta
│   │   ├── patients/             # Gestión de pacientes
│   │   ├── exercises/            # Biblioteca de ejercicios
│   │   ├── addExercise/          # Creación de ejercicios
│   │   ├── editExercises/        # Edición de ejercicios
│   │   └── admin/                # Panel de administración
│   │
│   ├── services/                 # Lógica de acceso a datos y APIs
│   │   ├── firebase.js           # Inicialización SDK Firebase
│   │   ├── therapistService.js   # Operaciones de terapeutas
│   │   ├── patientService.js     # Operaciones de pacientes
│   │   ├── exercisesService.js   # Operaciones de ejercicios + IA
│   │   ├── adminService.js       # Operaciones de administración
│   │   └── contextService.js     # Lectura de contextos
│   │
│   └── assets/                   # Imágenes, iconos estáticos
│
├── public/                       # Archivos estáticos servidos directamente
├── index.html                    # Shell HTML de la SPA
├── vite.config.js                # Configuración del bundler Vite
├── eslint.config.js              # Reglas de linting
├── package.json                  # Dependencias y scripts NPM
│
├── Dockerfile                    # Build multi-etapa (Node→Nginx)
├── nginx.conf                    # Configuración del servidor de producción
└── DEPLOYMENT.md                 # Guía de despliegue con Docker
```

### 3.2 Dependencias entre Módulos

```
main.jsx
  └── App.jsx  (React Router)
        ├── TerapeutaLogin ──────────────── therapistService
        │                                       └── firebase.js
        │                                       └── adminService
        ├── TerapeutaRegistro ───────────── therapistService
        ├── DashboardTerapeuta ──────────── therapistService
        ├── PacientesTerapeuta ──────────── therapistService
        ├── PacienteDetail ──────────────── patientService
        │     ├── PacientePersonalizar ──── exercisesService (personalizeExercise)
        │     ├── PatientAssignExercise ─── patientService + exercisesService
        │     ├── PacienteVNEST
        │     └── PacienteSR
        ├── EjerciciosTerapeuta ─────────── exercisesService
        │     ├── VNESTTable ─── VNESTExerciseModal
        │     └── SRTable ────── SRExerciseModal
        ├── SelectExerciseType
        ├── AddExerciseIA ───────────────── exercisesService (generateExercise)
        │                                       └── contextService
        └── AdminDashboard ──────────────── adminService
```

### 3.3 Diagrama de Dependencias de Paquetes NPM (principales)

```
Producción:
  react@19           → framework de UI
  react-dom@19       → renderizado en el DOM
  react-router-dom@7 → navegación entre vistas (SPA)
  firebase@12        → Auth, Firestore, Functions
  bootstrap@5        → sistema de diseño CSS
  bootstrap-icons@1  → iconografía
  react-icons@5      → iconos adicionales

Desarrollo:
  vite@7             → bundler / dev server con HMR
  @vitejs/plugin-react → transforma JSX con Babel
  eslint@9           → análisis estático de código
```

### 3.4 Estrategia de Estado

No se usa ninguna librería de estado global (Redux, Zustand, Context API). El estado es **local por componente** (`useState`) con **suscripciones Firestore en tiempo real** (`onSnapshot`) que actualizan el estado directamente. La sesión del terapeuta se persiste en `localStorage` (`terapeutaUID`).

---

## 4. Vista de Procesos

> Describe el **comportamiento dinámico** del sistema: flujos de ejecución, concurrencia y comunicación en tiempo real.

### 4.1 Proceso de Login

```
┌──────────┐      ┌────────────────────┐     ┌──────────────────┐    ┌────────────────┐
│ Usuario  │      │  TerapeutaLogin    │     │ therapistService │    │    Firebase    │
└────┬─────┘      └─────────┬──────────┘     └────────┬─────────┘    └───────┬────────┘
     │  ingresa email+pass  │                         │                      │
     │────────────────────►│                         │                      │
     │                     │  loginUnified()          │                      │
     │                     │─────────────────────────►│                      │
     │                     │                         │  authAdmin() check   │
     │                     │                         │  (credenciales fijas)│
     │                     │                         │                      │
     │                     │                         │  si NO es admin:     │
     │                     │                         │  signInWithEmail()   │
     │                     │                         │─────────────────────►│
     │                     │                         │◄─────────────────────│
     │                     │                         │  getDoc(terapeutas/) │
     │                     │                         │─────────────────────►│
     │                     │                         │◄─────────────────────│
     │                     │◄─────────────────────────│                      │
     │                     │  guarda UID en           │                      │
     │                     │  localStorage            │                      │
     │                     │  navega /dashboard       │                      │
     │◄────────────────────│  o /admin/dashboard      │                      │
```

### 4.2 Proceso de Suscripción en Tiempo Real (Dashboard)

```
DashboardTerapeuta.useEffect()
  │
  ├── getTherapistData(uid)           → petición única (getDoc)
  │     └── setTerapeuta(data)
  │
  ├── subscribeAssignedPatients(uid)  → onSnapshot(doc terapeutas/{uid})
  │     └── setNumPacientes(count)   ← se actualiza cada vez que cambia Firestore
  │
  └── subscribePendingVisibleExercises(uid) → onSnapshot(ejercicios)
        └── setNumPendientes(count)  ← filtrado client-side por visibilidad

  // Al desmontar el componente:
  return () => {
    unsubPacientes()    // cancela suscripción Firestore
    unsubEjercicios()   // cancela suscripción Firestore
  }
```

### 4.3 Proceso de Generación de Ejercicio con IA

```
┌──────────┐   ┌────────────┐   ┌──────────────────┐   ┌─────────────────────────────┐
│Terapeuta │   │AddExerciseIA│   │exercisesService  │   │  API IA (uniandes)          │
└────┬─────┘   └──────┬─────┘   └────────┬─────────┘   │  POST /api/context/generate │
     │                │                  │             └──────────────┬──────────────┘
     │ selecciona ctx │                  │                            │
     │────────────────►                  │                            │
     │                │ generateExercise │                            │
     │                │─────────────────►│                            │
     │                │                 │  fetch POST JSON           │
     │                │                 │───────────────────────────►│
     │                │                 │                            │ procesa con LLM
     │                │                 │◄───────────────────────────│
     │                │◄─────────────── │  retorna ejercicio VNEST   │
     │                │  muestra preview│                            │
     │◄───────────────│                 │                            │
```

### 4.4 Proceso de Aprobación de Terapeuta (Admin)

```
┌────────┐  ┌──────────────────┐  ┌──────────────┐  ┌────────────────────────────────┐
│ Admin  │  │  AdminDashboard  │  │ adminService │  │  Firebase Cloud Functions      │
└───┬────┘  └────────┬─────────┘  └──────┬───────┘  │  aprobarTerapeuta()            │
    │                │                   │          │  • crea usuario Firebase Auth   │
    │ click Aprobar  │                   │          │  • escribe en colección         │
    │───────────────►│                   │          │    terapeutas/                  │
    │                │ approveSolicitud()│          │  • envía email con contraseña   │
    │                │──────────────────►│          └────────────────────────────────┘
    │                │                  │  httpsCallable("aprobarTerapeuta")
    │                │                  │────────────────────────────────────────────►
    │                │                  │◄────────────────────────────────────────────
    │◄───────────────│  solicitud actualizada en Firestore
```

### 4.5 Proceso de Asignación y Personalización de Ejercicio

```
Terapeuta abre PacienteDetail
  │
  ├── PatientAssignExercise → assignExerciseToPatient(patientId, exerciseId)
  │     ├── lee ejercicios/{id} para obtener tipo y contexto
  │     ├── calcula próxima prioridad
  │     └── crea doc en pacientes/{id}/ejercicios_asignados/{ejercicioId}
  │
  └── PacientePersonalizar → personalizeExercise(userId, exerciseId, profile)
        └── POST /api/personalize-exercise/
              ├── API toma perfil del paciente
              ├── adapta el ejercicio con IA
              └── retorna ejercicio personalizado
```

---

## 5. Vista Física

> Describe cómo el software se **mapea sobre el hardware** y los nodos de infraestructura. Muestra el despliegue real.

### 5.1 Diagrama de Despliegue

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                    NODO: Máquina del Usuario (Browser)               │
  │                                                                      │
  │  ┌────────────────────────────────────────────────────────────────┐  │
  │  │              React SPA (cargada como HTML/JS/CSS estáticos)    │  │
  │  │                                                                │  │
  │  │   HTTPS/443  ──────────────────────────────────────────────►  │  │
  │  └────────────────────────────────────────────────────────────────┘  │
  └────────────────────────────────────────────────────────────────────┘
           │                           │                    │
           ▼                           ▼                    ▼
  ┌──────────────────┐    ┌───────────────────────┐  ┌────────────────┐
  │  NODO: Servidor  │    │  NODO: Firebase Cloud │  │  NODO: API IA  │
  │  Docker/Nginx    │    │  (Google Cloud)       │  │  Uniandes      │
  │                  │    │                       │  │                │
  │  ┌────────────┐  │    │  ┌─────────────────┐  │  │  ┌──────────┐ │
  │  │  Container │  │    │  │ Firebase Auth   │  │  │  │ /api/    │ │
  │  │  Nginx:80  │  │    │  │ (autenticación) │  │  │  │ context/ │ │
  │  │            │  │    │  └─────────────────┘  │  │  │ generate │ │
  │  │ /dist/*    │  │    │  ┌─────────────────┐  │  │  └──────────┘ │
  │  │ (archivos  │  │    │  │ Cloud Firestore  │  │  │  ┌──────────┐ │
  │  │  estáticos)│  │    │  │ (base de datos) │  │  │  │/personali│ │
  │  └────────────┘  │    │  └─────────────────┘  │  │  │ze-exerci-│ │
  │                  │    │  ┌─────────────────┐  │  │  │se/       │ │
  │  Puerto 8080     │    │  │ Cloud Functions │  │  │  └──────────┘ │
  │  (producción)    │    │  │ us-central1     │  │  │               │
  └──────────────────┘    │  └─────────────────┘  │  └───────────────┘
                          └───────────────────────┘
```

### 5.2 Artefactos de Despliegue

| Artefacto | Tecnología | Descripción |
|---|---|---|
| `Dockerfile` | Docker multi-stage | Stage 1: `node:20-alpine` compila con `npm run build`. Stage 2: `nginx:alpine` sirve los estáticos |
| `nginx.conf` | Nginx | Sirve SPA, soporte React Router (`try_files`), compresión gzip, headers de seguridad, caché de 1 año para estáticos |
| `/dist/` | Vite build | Archivos HTML/JS/CSS minificados generados por Vite |
| Firebase project `apphasia-7a930` | Google Cloud | Región `us-central1` para Cloud Functions |

### 5.3 Flujo de Red en Producción

```
Browser
  │
  ├──[HTTPS]──► Servidor Nginx (puerto 8080)
  │               └── retorna index.html (o archivos estáticos cacheados)
  │
  ├──[HTTPS/WSS]──► Firebase Firestore (wss://firestore.googleapis.com)
  │                   └── suscripciones onSnapshot via WebSocket (long-polling)
  │
  ├──[HTTPS]──► Firebase Auth (https://identitytoolkit.googleapis.com)
  │
  ├──[HTTPS]──► Firebase Functions (https://us-central1-apphasia-7a930.cloudfunctions.net)
  │
  └──[HTTPS]──► API IA Uniandes (https://afasia.virtual.uniandes.edu.co/api/)
```

### 5.4 Configuración de Firebase (datos de conexión)

| Parámetro | Valor |
|---|---|
| Project ID | `apphasia-7a930` |
| Auth Domain | `apphasia-7a930.firebaseapp.com` |
| Functions Region | `us-central1` |
| Firestore (modo) | `experimentalAutoDetectLongPolling` activo |

### 5.5 Health Check del Contenedor

El `Dockerfile` incluye un health check activo:

```
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
```

Endpoint adicional en Nginx: `GET /health` → `200 OK "healthy"`

---

## 6. Resumen de Decisiones Arquitectónicas

| Decisión | Elección | Justificación |
|---|---|---|
| **Arquitectura general** | SPA (Single Page Application) | Simplifica el despliegue (solo archivos estáticos); el routing es client-side con React Router |
| **Backend** | Firebase BaaS (Backend as a Service) | Elimina la necesidad de un servidor propio; Firestore provee tiempo real out-of-the-box |
| **Autenticación** | Firebase Auth | Integración nativa con Firestore; manejo seguro de sesiones |
| **Admin auth** | Credenciales hardcodeadas en `adminService.js` | Solución temporal/simple; recomendación: migrar a Firebase Auth con claims de rol |
| **IA para ejercicios** | API REST externa (Uniandes) | El modelo de lenguaje corre en infraestructura de la universidad, desacoplado del frontend |
| **Estado de la app** | Estado local + `onSnapshot` | Evita overhead de Redux/Zustand; Firestore provee sincronización reactiva |
| **Sesión** | `localStorage` (terapeutaUID) | Solución sencilla; no hay refresh token explícito, Firebase Auth maneja la persistencia internamente |
| **Despliegue** | Docker + Nginx | Portabilidad total; Nginx optimizado para SPAs (gzip, caché, try_files) |
| **Visibilidad de ejercicios** | Filtrado client-side | Se obtienen todos los ejercicios y se filtran en memoria; adecuado para volúmenes pequeños |
| **Tipos de terapia** | VNEST + SR | Dos colecciones separadas (`ejercicios_VNEST`, `ejercicios_SR`) permiten esquemas distintos por tipo |

---

*Documento generado el 3 de marzo de 2026. Basado en análisis estático del código fuente de la versión 0.0.0.*

---

## 7. Diagrama Lógico MVVM

> Muestra cómo el patrón **Model — ViewModel — View** se materializa en cada módulo del proyecto. La dirección de las flechas indica dependencia: la View nunca conoce al Model directamente.

### 7.1 Estructura General MVVM

```
╔══════════════════════════════════════════════════════════════════════════╗
║                               V I E W                                   ║
║                   JSX declarativo — return( <...> )                     ║
║                                                                          ║
║  ┌─────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────┐  ║
║  │TerapeutaLogin│ │DashboardTerapeuta│ │PacientesTerapeuta│ │EjerciciosTerapeuta│ ║
║  └──────┬──────┘ └───────┬───────┘ └──────┬───────┘ └───────┬───────┘  ║
║         │               │                │               │             ║
║  ┌──────┴──────┐ ┌───────┴───────┐ ┌──────┴───────┐ ┌───────┴───────┐  ║
║  │TerapeutaRegistro│ │PacienteDetail│ │PatientAssignExercise│ │AddExerciseIA│ ║
║  └─────────────┘ └───────────────┘ └──────────────┘ └───────────────┘  ║
╠══════════════════════════════════════════════════════════════════════════╣
║              Data Binding (useState · useEffect · handlers)             ║
║                    ↑ notifica cambios     ↓ invoca acciones             ║
╠══════════════════════════════════════════════════════════════════════════╣
║                           V I E W   M O D E L                           ║
║              Hooks de estado y efectos dentro del componente            ║
║                                                                          ║
║  const [terapeuta, setTerapeuta]   = useState(null)                     ║
║  const [pacientes, setPacientes]   = useState([])                       ║
║  const [ejercicios, setEjercicios] = useState([])                       ║
║  const [loading, setLoading]       = useState(false)                    ║
║                                                                          ║
║  useEffect(() => {                                                       ║
║    // suscribirse al Model                                               ║
║    const unsub = servicio.suscribir(uid, setDato)                       ║
║    return () => unsub()   ← limpia al desmontar                         ║
║  }, [])                                                                  ║
║                                                                          ║
║  const handleAccion = async () => {    ← transforma evento de View      ║
║    await servicio.operacion(params)    ← delega al Model                ║
║  }                                                                       ║
╠══════════════════════════════════════════════════════════════════════════╣
║                           M O D E L                                     ║
║                      src/services/*.js                                   ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### 7.2 Diagrama MVVM por Módulo Funcional

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MÓDULO: AUTENTICACIÓN                                                      │
├──────────────────────┬──────────────────────────┬───────────────────────────┤
│       VIEW           │       VIEWMODEL           │         MODEL             │
├──────────────────────┼──────────────────────────┼───────────────────────────┤
│ TerapeutaLogin.jsx   │ email, password →         │ therapistService          │
│  <form>              │   useState                │  loginUnified()           │
│  <input email>       │ loading → useState        │    └─ authAdmin()         │
│  <input password>    │                           │    └─ loginTherapist()    │
│  <button Ingresar>   │ handleLogin = async () => │         └─ Firebase Auth  │
│                      │   setLoading(true)        │              signIn()     │
│ TerapeutaRegistro    │   res = loginUnified()    │         └─ Firestore      │
│  <form solicitud>    │   navigate(/dashboard)    │              getDoc()     │
│                      │                           │                           │
│                      │ handleRegistro = () =>    │  sendTherapistRequest()   │
│                      │   sendTherapistRequest()  │    └─ Firestore addDoc    │
│                      │   navigate(/)             │       (solicitudes)       │
└──────────────────────┴──────────────────────────┴───────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MÓDULO: DASHBOARD                                                          │
├──────────────────────┬──────────────────────────┬───────────────────────────┤
│       VIEW           │       VIEWMODEL           │         MODEL             │
├──────────────────────┼──────────────────────────┼───────────────────────────┤
│ DashboardTerapeuta   │ terapeuta → useState      │ therapistService          │
│  <h2>Bienvenido</h2> │ numPacientes → useState   │  getTherapistData()       │
│  <card># pacientes   │ numPendientes → useState  │    └─ Firestore getDoc    │
│  <card># pendientes  │                           │                           │
│  <Navbar>            │ useEffect:                │  subscribeAssignedPatients│
│                      │   getTherapistData()      │    └─ onSnapshot(doc)     │
│                      │   subscribeAssignedPacients│                          │
│                      │   subscribePendingVisible  │ subscribePendingVisible   │
│                      │                           │   Exercises()             │
│                      │   ← datos llegan solos    │    └─ onSnapshot(query)   │
│                      │     vía Firestore reactive│       filtro client-side  │
└──────────────────────┴──────────────────────────┴───────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MÓDULO: PACIENTES                                                          │
├──────────────────────┬──────────────────────────┬───────────────────────────┤
│       VIEW           │       VIEWMODEL           │         MODEL             │
├──────────────────────┼──────────────────────────┼───────────────────────────┤
│ PacientesTerapeuta   │ pacientes → useState      │ therapistService          │
│  <lista pacientes>   │                           │  getPatientsByTherapist() │
│  <buscador>          │ useEffect:                │    └─ onSnapshot(query)   │
│  <AddPatient modal>  │  getPatientsByTherapist() │       where terapeuta==uid│
│                      │  ← push en tiempo real    │                           │
│ PacienteDetail       │                           │ patientService            │
│  <tabs VNEST / SR>   │ exercises → useState      │  getAssignedExercises()   │
│  <lista ejercicios>  │ patientInfo → useState    │    └─ onSnapshot          │
│  <botón asignar>     │ showModal → useState      │       (subcolección)      │
│  <botón personalizar>│                           │  getPatientById()         │
│                      │ handleAssign = () =>      │  assignExerciseToPatient()│
│                      │   setShowModal(true)      │    └─ setDoc en Firestore │
│                      │                           │                           │
│                      │ handlePersonalize = () => │ exercisesService          │
│                      │   personalizeExercise()   │  personalizeExercise()    │
│                      │                           │    └─ POST /api/personali-│
│                      │                           │       ze-exercise/        │
└──────────────────────┴──────────────────────────┴───────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MÓDULO: EJERCICIOS                                                         │
├──────────────────────┬──────────────────────────┬───────────────────────────┤
│       VIEW           │       VIEWMODEL           │         MODEL             │
├──────────────────────┼──────────────────────────┼───────────────────────────┤
│ EjerciciosTerapeuta  │ exercises → useState      │ exercisesService          │
│  <VNESTTable>        │ activeTab → useState      │  getVisibleExercises()    │
│  <SRTable>           │ selectedEx → useState     │    └─ onSnapshot +        │
│  <modal detalle>     │                           │       filtro visibilidad  │
│                      │ useEffect:                │                           │
│ AddExerciseIA        │   getVisibleExercises()   │  generateExercise()       │
│  <select contexto>   │                           │    └─ POST /api/context/  │
│  <select nivel>      │ context → useState        │       generate            │
│  <button Generar>    │ nivel → useState          │                           │
│  <preview resultado> │ result → useState         │  contextService           │
│                      │ loading → useState        │  getAllContexts()          │
│                      │                           │    └─ Firestore getDocs   │
│                      │ handleGenerate = () =>    │       (contextos)         │
│                      │   generateExercise()      │                           │
│                      │   setResult(data)         │  deleteExercise()         │
│                      │                           │  updateExercise()         │
│                      │ handleDelete = () =>      │    └─ Firestore deleteDoc │
│                      │   deleteExercise(id)      │       / updateDoc         │
└──────────────────────┴──────────────────────────┴───────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MÓDULO: ADMINISTRACIÓN                                                     │
├──────────────────────┬──────────────────────────┬───────────────────────────┤
│       VIEW           │       VIEWMODEL           │         MODEL             │
├──────────────────────┼──────────────────────────┼───────────────────────────┤
│ AdminDashboard       │ solicitudes → useState    │ adminService              │
│  <lista solicitudes> │ loading → useState        │  getSolicitudes()         │
│  <botón Aprobar>     │                           │    └─ Firestore getDocs   │
│  <botón Rechazar>    │ handleApprove = () =>     │                           │
│                      │   approveSolicitud()      │  approveSolicitud()       │
│                      │   refrescarLista()        │    └─ httpsCallable       │
│                      │                           │      (aprobarTerapeuta)   │
│                      │ handleReject = () =>      │      Cloud Function       │
│                      │   rejectSolicitud()       │                           │
│                      │                           │  rejectSolicitud()        │
│                      │                           │    └─ httpsCallable       │
│                      │                           │      (rechazarTerapeuta)  │
└──────────────────────┴──────────────────────────┴───────────────────────────┘
```

### 7.3 Flujo de Datos MVVM (dirección de la información)

```
  EVENTO DE USUARIO                    ACTUALIZACIÓN DE UI
  (click, input, submit)               (re-render React)
         │                                    ▲
         ▼                                    │
  ┌─────────────────────────────────────────────────────┐
  │                  V I E W M O D E L                  │
  │                                                     │
  │  handler captura evento                             │
  │       │                                             │
  │       ▼                                 setState()  │
  │  llama al Model (service)  ──────────►  actualiza  │
  │       │                                 estado      │
  │       │   (respuesta async / onSnapshot)    │       │
  │       └────────────────────────────────────┘       │
  └─────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    │
  ┌─────────────┐                    ┌────────┴────────┐
  │    MODEL    │                    │   React render  │
  │  services   │                    │   nuevo JSX     │
  │  Firestore  │                    └─────────────────┘
  │  API REST   │
  └─────────────┘
         │
         ▼
  ┌─────────────────────┐
  │  Firebase Firestore  │ ──onSnapshot──► ViewModel.setState() ──► re-render
  │  API IA Uniandes     │ ──response────► ViewModel.setState() ──► re-render
  │  Firebase Functions  │ ──response────► ViewModel.setState() ──► re-render
  └─────────────────────┘
```

### 7.4 Comparación: MVVM clásico vs React (este proyecto)

| Concepto | MVVM Clásico (Angular/WPF) | Este proyecto (React) |
|---|---|---|
| **View** | Template HTML separado | `return(<JSX>)` en el `.jsx` |
| **ViewModel** | Clase TypeScript separada | `useState` + `useEffect` + handlers en el mismo `.jsx` |
| **Model** | Servicios / Repositorios | `src/services/*.js` |
| **Binding** | Two-way binding automático | One-way: `setState()` re-renderiza; eventos llaman handlers |
| **Observabilidad** | Observables (RxJS) | `onSnapshot` de Firestore |
| **Separación física** | Archivos distintos para View y VM | Mismo archivo `.jsx` (View + ViewModel acoplados) |

> **Nota:** La separación View/ViewModel en este proyecto es **lógica, no física**. El JSX es la View y los hooks son el ViewModel, pero conviven en el mismo archivo. Esta es la forma idiomática de React y no es una deficiencia, sino una característica del framework.
