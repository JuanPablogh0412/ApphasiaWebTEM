# Guía de Empalme — RehabilitIA Web App

> **Propósito de este documento:** Permitir que un nuevo desarrollador entienda el proyecto completamente y pueda agregar una nueva terapia de forma autónoma y correcta.  
> **Fecha de elaboración:** Marzo 2026  
> **Stack:** React 19 · Vite · Firebase (Auth, Firestore, Functions) · Docker + Nginx

---

## Tabla de Contenido

1. [¿Qué es este proyecto?](#1-qué-es-este-proyecto)
2. [Cómo correr el proyecto localmente](#2-cómo-correr-el-proyecto-localmente)
3. [Estructura de carpetas explicada](#3-estructura-de-carpetas-explicada)
4. [Cómo funciona Firebase en la app](#4-cómo-funciona-firebase-en-la-app)
5. [Modelo de datos en Firestore](#5-modelo-de-datos-en-firestore)
6. [Flujo de autenticación](#6-flujo-de-autenticación)
7. [Módulos de la aplicación](#7-módulos-de-la-aplicación)
   - 7.1 [Login y Registro](#71-login-y-registro)
   - 7.2 [Dashboard](#72-dashboard)
   - 7.3 [Pacientes](#73-pacientes)
   - 7.4 [Ejercicios (Biblioteca)](#74-ejercicios-biblioteca)
   - 7.5 [Creación de ejercicios con IA](#75-creación-de-ejercicios-con-ia)
   - 7.6 [Detalle de Paciente y terapias](#76-detalle-de-paciente-y-terapias)
   - 7.7 [Administración](#77-administración)
8. [Capa de Servicios (services/)](#8-capa-de-servicios-services)
9. [Reglas de negocio clave](#9-reglas-de-negocio-clave)
10. [Arquitectura resumida (MVVM + BaaS)](#10-arquitectura-resumida-mvvm--baas)
11. [Cómo agregar una nueva terapia](#11-cómo-agregar-una-nueva-terapia)

---

## 1. ¿Qué es este proyecto?

**RehabilitIA** es una aplicación web para terapeutas que trabajan con pacientes con **afasia** (trastorno del lenguaje). Permite:

- Gestionar una lista de pacientes asignados al terapeuta
- Consultar y administrar una biblioteca de ejercicios terapéuticos
- Crear ejercicios automáticamente con **Inteligencia Artificial**
- Asignar ejercicios a pacientes específicos
- Personalizar ejercicios para el perfil individual de un paciente (con IA)
- Monitorear el progreso de cada paciente por tipo de terapia
- Aprobar o rechazar solicitudes de nuevos terapeutas (rol Admin)

Actualmente soporta **dos tipos de terapia**:

| Código | Nombre completo | Descripción breve |
|---|---|---|
| `VNEST` | Verb Network Strengthening Treatment | Ejercicios basados en redes verbales: verbo + expansiones + oraciones |
| `SR` | Sentence Reading | Ejercicios de lectura: pregunta + respuesta correcta |

---

## 2. Cómo correr el proyecto localmente

### Requisitos previos
- Node.js 18+ instalado
- npm instalado
- Acceso al proyecto Firebase `apphasia-7a930` (o las credenciales ya están en `firebase.js`)

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo con hot-reload
npm run dev

# 3. Abrir en el navegador → http://localhost:5173
```

### Otros comandos

```bash
npm run build      # Compila para producción → genera /dist/
npm run preview    # Sirve localmente el build de producción
npm run lint       # Corre ESLint para detectar errores de código
```

### Despliegue con Docker (producción)

```bash
docker build -t web-therapist:latest .
docker run -d -p 8080:80 web-therapist:latest
# → disponible en http://localhost:8080
```

El `Dockerfile` hace un **build multi-etapa**:
1. `node:20-alpine` → compila React con Vite → genera `/dist/`
2. `nginx:alpine` → sirve los archivos estáticos de `/dist/` con Nginx

---

## 3. Estructura de carpetas explicada

```
src/
├── main.jsx                  # Punto de entrada. Monta <App> en el DOM
├── App.jsx                   # Define TODAS las rutas de la app (React Router)
│
├── components/               # 📦 Componentes de interfaz de usuario
│   ├── common/               # Componentes reutilizables en toda la app
│   │   ├── Navbar.jsx        # Barra de navegación superior fija
│   │   └── Footer.jsx        # Pie de página
│   │
│   ├── login/                # Pantallas de autenticación
│   │   ├── TerapeutaLogin.jsx     # Formulario de login (terapeuta + admin)
│   │   └── TerapeutaRegistro.jsx  # Formulario de solicitud de registro
│   │
│   ├── dashboard/            # Vista principal tras hacer login
│   │   └── DashboardTerapeuta.jsx # Resumen: # pacientes + # ejercicios pendientes
│   │
│   ├── patients/             # Todo lo relacionado con pacientes
│   │   ├── PacientesTerapeuta.jsx   # Lista de pacientes del terapeuta
│   │   ├── PacienteDetail.jsx       # Vista de detalle de un paciente
│   │   ├── PacienteVNEST.jsx        # Tabla de ejercicios VNEST del paciente
│   │   ├── PacienteSR.jsx           # Tabla de ejercicios SR del paciente
│   │   ├── PacientePersonalizar.jsx # Modal para personalizar ejercicio con IA
│   │   └── PatientAssignExercise.jsx# Modal para asignar ejercicio al paciente
│   │
│   ├── exercises/            # Vista de la biblioteca de ejercicios
│   │   ├── EjerciciosTerapeuta.jsx  # Página principal con tabs VNEST/SR
│   │   ├── VNESTTable.jsx           # Tabla filtrable de ejercicios VNEST
│   │   ├── SRTable.jsx              # Tabla filtrable de ejercicios SR
│   │   ├── VNESTExerciseModal.jsx   # Modal de lectura/detalle de ejercicio VNEST
│   │   └── SRExerciseModal.jsx      # Modal de lectura/detalle de ejercicio SR
│   │
│   ├── addExercise/          # Flujo de creación de nuevos ejercicios
│   │   ├── SelectExerciseType.jsx   # Pantalla selector: IA vs manual
│   │   └── AddExerciseIA.jsx        # Formulario para generar ejercicio VNEST con IA
│   │
│   ├── editExercises/        # Editores para modificar ejercicios existentes
│   │   ├── VNESTEditor.jsx          # Formulario de edición de ejercicio VNEST
│   │   └── SREditor.jsx             # Formulario de edición de ejercicio SR
│   │
│   └── admin/                # Panel de administración
│       └── AdminDashboard.jsx       # Gestión de solicitudes de nuevos terapeutas
│
└── services/                 # 🔧 Lógica de negocio y acceso a Firebase/APIs
    ├── firebase.js            # Inicialización del SDK de Firebase
    ├── therapistService.js    # Operaciones del terapeuta (login, pacientes, etc.)
    ├── patientService.js      # Operaciones de pacientes (asignar, buscar, etc.)
    ├── exercisesService.js    # Operaciones de ejercicios + llamadas a API IA
    ├── adminService.js        # Operaciones de administrador (solicitudes)
    └── contextService.js      # Lee la colección "contextos" de Firestore
```

> **Patrón:** Cada componente `.jsx` contiene su propio archivo `.css` con el mismo nombre en la misma carpeta.

---

## 4. Cómo funciona Firebase en la app

Firebase **no es una API REST externa** que se llama con `fetch()`. Es un **SDK de JavaScript** instalado como paquete NPM (`firebase@12`). Se inicializa una sola vez en `src/services/firebase.js` y exporta tres objetos que se usan en toda la app:

```js
// src/services/firebase.js
export const db        // Firestore: base de datos NoSQL
export const auth      // Firebase Authentication
export const functions // Cloud Functions (serverless)
```

### Tipos de comunicación

| Objeto | Cuándo se usa | Protocolo real |
|---|---|---|
| `db` con `getDoc`, `getDocs` | Lectura única | HTTPS → respuesta inmediata |
| `db` con `onSnapshot` | Suscripción reactiva | WebSocket → Firestore empuja cambios |
| `db` con `setDoc`, `updateDoc`, `deleteDoc` | Escritura | HTTPS |
| `auth` con `signInWithEmailAndPassword` | Autenticación | HTTPS a Google Identity |
| `functions` con `httpsCallable` | Invocar Cloud Function | HTTPS a Google Cloud Run |

> **Importante:** `onSnapshot` es lo que hace la app "en tiempo real". Se usa en el Dashboard, lista de pacientes y ejercicios. Cuando los datos cambian en Firestore, la UI se actualiza automáticamente sin tu intervención.

---

## 5. Modelo de datos en Firestore

Firestore organiza los datos en **colecciones** (como tablas) de **documentos** (como filas JSON). El esquema completo es:

### Colección `terapeutas/{uid}`
```json
{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "profesion": "Fonoaudióloga",
  "celular": "3001234567",
  "pacientes": ["uid_paciente_1", "uid_paciente_2"]
}
```
> El ID del documento es el **UID de Firebase Auth** del terapeuta.

---

### Colección `pacientes/{uid}`
```json
{
  "nombre": "María García",
  "email": "maria@example.com",
  "terapeuta": "uid_terapeuta",
  "perfil": { ... }
}
```
> El `perfil` es usado por la IA al personalizar ejercicios.

#### Subcolección `pacientes/{uid}/ejercicios_asignados/{ejercicioId}`
```json
{
  "id_ejercicio": "abc123",
  "tipo": "VNEST",
  "estado": "pendiente",
  "prioridad": 1,
  "veces_realizado": 0,
  "ultima_fecha_realizado": null,
  "fecha_asignacion": "timestamp",
  "personalizado": false,
  "contexto": "Educación"
}
```
> Esta subcolección es la que guarda qué ejercicios tiene asignados cada paciente y su progreso.

---

### Colección `ejercicios/{id}` — **Metadatos generales**
```json
{
  "terapia": "VNEST",
  "tipo": "publico",
  "nivel": "fácil",
  "revisado": false,
  "personalizado": false,
  "creado_por": "uid_terapeuta",
  "id_paciente": "uid_paciente",
  "fecha_creacion": "timestamp"
}
```
> **Esta es la colección central.** Todos los ejercicios, sin importar la terapia, tienen un documento aquí con sus metadatos. El campo `terapia` es la clave para saber dónde están los detalles.

---

### Colección `ejercicios_VNEST/{id}` — **Detalles de ejercicio VNEST**
```json
{
  "verbo": "cocinar",
  "nivel": "fácil",
  "contexto": "Actividades domésticas",
  "pares": [
    {
      "pregunta": "¿Quién cocina?",
      "respuesta": "El chef",
      "expansiones": {
        "quien": { "opciones": ["chef", "mamá", "papá"] },
        "que": { "opciones": ["sopa", "arroz"] }
      }
    }
  ],
  "oraciones": [
    { "oracion": "El chef cocina sopa.", "correcta": true }
  ]
}
```
> El ID del documento es **el mismo** que el ID en `ejercicios/`. Viven en colecciones separadas para poder tener esquemas distintos por tipo de terapia.

---

### Colección `ejercicios_SR/{id}` — **Detalles de ejercicio SR**
```json
{
  "pregunta": "¿Cuál es la capital de Colombia?",
  "rta_correcta": "Bogotá",
  "contexto": "Educación"
}
```

---

### Colección `contextos/{id}`
```json
{
  "context": "Contexto libre"
}
```
> Contextos disponibles para seleccionar al generar un ejercicio con IA. Se cargan dinámicamente desde Firestore.

---

### Colección `solicitudes/{id}`
```json
{
  "nombre": "Ana Rodríguez",
  "email": "ana@example.com",
  "profesion": "Terapeuta ocupacional",
  "motivacion": "Quiero ayudar a pacientes...",
  "celular": "3009876543",
  "estado": "pendiente",
  "fecha": "timestamp"
}
```
> El Admin aprueba o rechaza estos documentos. Al aprobar, se invoca una Cloud Function que crea el usuario en Firebase Auth y escribe en `terapeutas/`.

---

## 6. Flujo de autenticación

El login es **unificado** en una sola pantalla (`/`). La función `loginUnified()` en `therapistService.js` determina el tipo de usuario:

```
Usuario ingresa email + password
          ↓
   loginUnified(email, password)
          ↓
   ¿Es admin? (credenciales hardcodeadas en adminService.js)
   ├── SÍ → navigate("/admin/dashboard")
   └── NO → loginTherapist() con Firebase Auth
              ↓
         signInWithEmailAndPassword(auth, email, password)
              ↓
         getDoc(db, "terapeutas", user.uid)
              ↓
         Guarda en localStorage:
           - terapeutaEmail
           - terapeutaUID
           - terapeutaData (JSON)
              ↓
         navigate("/dashboard")
```

> **Sesión:** La sesión del terapeuta se guarda en `localStorage`. El UID es lo más importante: se usa en todas las consultas a Firestore para filtrar los datos del terapeuta autenticado.

> **Protección de rutas:** No hay un guard de ruta centralizado. Cada componente que requiere login verifica al inicio con `auth.onAuthStateChanged(user => { if (!user) navigate("/"); })`.

---

## 7. Módulos de la aplicación

### 7.1 Login y Registro

**Archivos:** `components/login/TerapeutaLogin.jsx`, `TerapeutaRegistro.jsx`

- **Login** (`/`): Llama a `loginUnified()`. Si es admin va a `/admin/dashboard`. Si es terapeuta va a `/dashboard`.
- **Registro** (`/registro`): No crea directamente al terapeuta. Envía una solicitud (`sendTherapistRequest()`) que queda en la colección `solicitudes` del Firestore con estado `"pendiente"`. Un admin debe aprobarla.

---

### 7.2 Dashboard

**Archivo:** `components/dashboard/DashboardTerapeuta.jsx`  
**Ruta:** `/dashboard`

Muestra una bienvenida personalizada y dos contadores en tiempo real:
- **Pacientes asignados:** suscripción `onSnapshot` al documento `terapeutas/{uid}`
- **Ejercicios pendientes de revisión:** suscripción `onSnapshot` a la colección `ejercicios` filtrada por `revisado == false`, y luego filtrado client-side por reglas de visibilidad

---

### 7.3 Pacientes

**Archivos:** `components/patients/PacientesTerapeuta.jsx`, `addPatient/AddPatient.jsx`  
**Ruta:** `/pacientes`

- Lista paginada (10 por página) de pacientes del terapeuta
- Búsqueda por email en tiempo real (filtro client-side)
- Botón **"+ Agregar Paciente"** abre `AddPatient` (modal)
  - Busca al paciente por su **email** en Firestore
  - Si lo encuentra, lo asigna al terapeuta: actualiza `pacientes/{uid}.terapeuta` y agrega el ID a `terapeutas/{uid}.pacientes`
- Click en una fila navega a `/pacientes/:pacienteId`

---

### 7.4 Ejercicios (Biblioteca)

**Archivo:** `components/exercises/EjerciciosTerapeuta.jsx`  
**Ruta:** `/ejercicios`

Es la **biblioteca completa** de ejercicios visibles para el terapeuta. Tiene tabs para cada tipo de terapia.

**Estructura visual:**
```
[ Tab: VNEST ] [ Tab: SR ]
┌──────────────────────────────────┐
│  Filtros (verbo, contexto, etc.) │
│  Tabla paginada con botones      │
│    Ver | Editar | Eliminar       │
└──────────────────────────────────┘
```

**Flujo de carga:**
1. `getVisibleExercises(uid, callback)` → suscripción a todos los ejercicios visibles
2. Para cada ejercicio, `getExerciseDetails(id, terapia)` → trae los detalles de `ejercicios_VNEST/` o `ejercicios_SR/`
3. Si el ejercicio tiene `id_paciente`, `getPatientById()` → completa el nombre/email del paciente

**Acciones:**
- **Ver** → abre `VNESTExerciseModal` o `SRExerciseModal` (modal de solo lectura)
- **Editar** → abre `VNESTEditor` o `SREditor` (modal de edición)
- **Eliminar** → `deleteExercise(id, terapia)` borra de `ejercicios/` y de `ejercicios_VNEST/` o `ejercicios_SR/`

---

### 7.5 Creación de ejercicios con IA

**Archivos:** `components/addExercise/SelectExerciseType.jsx`, `AddExerciseIA.jsx`  
**Rutas:** `/ejercicios/nuevo` → `/ejercicios/nuevo/ia`

1. `SelectExerciseType`: Pantalla con dos opciones: **IA** (activa) y **Manual** (desactivada, "Próximamente")
2. `AddExerciseIA`: Formulario con:
   - **Contexto:** dropdown cargado desde `contextos/` en Firestore
   - **Nivel:** fácil / medio / difícil
   - **Visibilidad:** público / privado
   - Botón **"Generar"** → llama a `generateExercise()` → `POST https://afasia.virtual.uniandes.edu.co/api/context/generate`
   - La IA retorna el ejercicio → se muestra preview
   - El ejercicio se guarda automáticamente en Firestore

> **Nota:** Esta funcionalidad hoy solo genera ejercicios **VNEST**. No genera SR.

---

### 7.6 Detalle de Paciente y terapias

**Archivo:** `components/patients/PacienteDetail.jsx`  
**Ruta:** `/pacientes/:pacienteId`

Esta es la vista más compleja. Muestra toda la información de un paciente y sus ejercicios asignados.

**Estructura visual:**
```
[ Nombre del paciente ]
[ Botón Asignar ] [ Botón Personalizar ]

[ Tab: VNEST ] [ Tab: SR ]
┌──────────────────────────────────┐
│  PacienteVNEST o PacienteSR      │
│  Tabla de ejercicios asignados   │
│  con estado (pendiente/completado│
└──────────────────────────────────┘
```

**Flujo de carga:**
1. `getAssignedExercises(pacienteId, callback)` → suscripción `onSnapshot` a la subcolección `pacientes/{id}/ejercicios_asignados`
2. Para cada ejercicio asignado: `getExerciseById(id)` + `getExerciseDetails(id, terapia)` → enriquece los datos
3. Los datos enriquecidos se pasan a `PacienteVNEST` y `PacienteSR` según el tab activo

**Botones:**
- **Asignar ejercicio** → abre `PatientAssignExercise` (modal de búsqueda y asignación)
- **Personalizar** → abre `PacientePersonalizar` (modal que llama a la API IA para crear versión adaptada)

**`PacienteVNEST`** — muestra solo los ejercicios con `terapia === "VNEST"`, con filtros por estado, verbo y contexto.

**`PacienteSR`** — muestra solo los ejercicios con `terapia === "SR"`, con filtros por estado y pregunta.

**`VNESTExerciseModal` / `SRExerciseModal`** — modales de solo lectura que muestran todos los detalles de un ejercicio, incluyendo nombre del paciente y terapeuta.

---

### 7.7 Administración

**Archivo:** `components/admin/AdminDashboard.jsx`  
**Ruta:** `/admin/dashboard`

Panel exclusivo para el administrador. Muestra las solicitudes de registro de nuevos terapeutas con opciones de **Aprobar** o **Rechazar**.

- **Aprobar:** invoca Cloud Function `aprobarTerapeuta` → crea usuario en Firebase Auth + escribe en `terapeutas/` + envía email
- **Rechazar:** invoca Cloud Function `rechazarTerapeuta` → envía email de rechazo

> **Seguridad actual:** Las credenciales de admin son strings hardcodeados en `adminService.js`. Es una solución temporal — en el futuro debería migrarse a Firebase custom claims.

---

## 8. Capa de Servicios (services/)

Todos los archivos en `src/services/` son la capa de datos. Los componentes **nunca hablan directamente con Firebase**, siempre lo hacen a través de estas funciones.

### `firebase.js`
Inicializa y exporta `db`, `auth`, `functions`. Es importado por todos los demás servicios.

---

### `therapistService.js`

| Función | Qué hace |
|---|---|
| `loginUnified(email, password)` | Login unificado admin/terapeuta |
| `loginTherapist(email, password)` | Login con Firebase Auth + lee datos de Firestore |
| `getTherapistData(uid)` | Obtiene datos del terapeuta por UID |
| `getPatientsByTherapist(uid, callback)` | Suscripción a pacientes del terapeuta (onSnapshot) |
| `subscribeAssignedPatients(uid, callback)` | Suscripción al conteo de pacientes asignados |
| `subscribePendingVisibleExercises(uid, callback)` | Suscripción al conteo de ejercicios pendientes visibles |
| `sendTherapistRequest(data)` | Envía solicitud de registro a colección `solicitudes` |
| `resetTherapistPassword(email)` | Envía correo de restablecimiento de contraseña |

---

### `patientService.js`

| Función | Qué hace |
|---|---|
| `getPatientById(patientId)` | Obtiene un paciente por su UID |
| `getPatientByEmail(email)` | Busca un paciente por su email |
| `updatePatient(patientId, data)` | Actualiza campos de un paciente |
| `assignPatientToTherapist(patientId, therapistId)` | Vincula paciente con terapeuta en ambas colecciones |
| `assignExerciseToPatient(patientId, exerciseId)` | Asigna ejercicio a paciente (crea doc en subcolección) |
| `getAssignedExercises(patientId, callback)` | Suscripción a ejercicios asignados del paciente (onSnapshot) |

---

### `exercisesService.js`

| Función | Qué hace |
|---|---|
| `getAllExercises(callback)` | Suscripción a todos los ejercicios (sin filtro) |
| `getVisibleExercisesOnce(therapistId)` | Lectura única de ejercicios visibles (para búsqueda) |
| `getVisibleExercises(therapistId, callback)` | Suscripción a ejercicios visibles con filtrado client-side |
| `getExerciseDetails(id, terapia)` | Lee detalles de `ejercicios_VNEST/` o `ejercicios_SR/` según `terapia` |
| `getExerciseById(id)` | Lee metadatos generales de `ejercicios/{id}` |
| `deleteExercise(id, terapia)` | Elimina de `ejercicios/` y de la colección específica |
| `updateExercise(id, data)` | Actualiza metadatos en `ejercicios/{id}` |
| `updateExerciseSR(id, data)` | Actualiza detalles en `ejercicios_SR/{id}` |
| `generateExercise(payload)` | `POST /api/context/generate` → genera ejercicio VNEST con IA |
| `personalizeExercise(userId, exerciseId, profile, creado_por)` | `POST /api/personalize-exercise/` → adapta ejercicio con IA |

---

### `adminService.js`

| Función | Qué hace |
|---|---|
| `authAdmin(email, password)` | Valida credenciales de administrador (hardcodeadas) |
| `getSolicitudes()` | Lee todas las solicitudes de `solicitudes/` |
| `approveSolicitud(solicitud)` | Invoca Cloud Function `aprobarTerapeuta` |
| `rejectSolicitud(solicitud)` | Invoca Cloud Function `rechazarTerapeuta` |

---

### `contextService.js`

| Función | Qué hace |
|---|---|
| `getAllContexts()` | Lee todos los documentos de la colección `contextos/` |

---

## 9. Reglas de negocio clave

### Visibilidad de ejercicios (`getVisibleExercises`)

Un ejercicio de la biblioteca es visible para un terapeuta si cumple **alguna** de estas condiciones:

```
ejercicio.tipo === "publico"                         → siempre visible para todos
ejercicio.tipo === "privado" && creado_por === uid   → lo creó este terapeuta
ejercicio.tipo === "privado" && id_paciente ∈ [pacientes del terapeuta] → asignado a su paciente
```

El filtrado es **client-side**: se traen todos los ejercicios y se filtran en memoria.

### Asignación de ejercicios (`assignExerciseToPatient`)

Al asignar un ejercicio a un paciente:
1. Lee los metadatos de `ejercicios/{id}` para saber el tipo de terapia
2. Lee los detalles de `ejercicios_VNEST/` o `ejercicios_SR/` para obtener el contexto
3. Calcula la próxima prioridad (máximo actual + 1)
4. Crea un documento en `pacientes/{id}/ejercicios_asignados/{ejercicioId}` con estado `"pendiente"`

### El campo `terapia` en `ejercicios/{id}` es crítico

Este campo determina en qué colección de detalles buscar al cargar un ejercicio. Si es `"VNEST"` → `ejercicios_VNEST/`. Si es `"SR"` → `ejercicios_SR/`. Toda la lógica de bifurcación en la app depende de este campo.

---

## 10. Arquitectura resumida (MVVM + BaaS)

```
VIEW (JSX)          ←→  VIEWMODEL (useState + useEffect)  ←→  MODEL (services/)
                                                                    ↕
                                                          Firebase (Firestore, Auth, Functions)
                                                                    ↕
                                                          API IA externa (uniandes)
```

- **Patrón:** MVVM implícito. Cada componente React contiene su View (JSX) y su ViewModel (hooks).
- **Backend:** 100% Firebase (BaaS). No hay servidor propio.
- **Tiempo real:** `onSnapshot` de Firestore. Se usa en Dashboard, lista de pacientes y ejercicios asignados.
- **Estado:** Local por componente con `useState`. No hay Redux ni Context API global.
- **Sesión:** `localStorage` guarda `terapeutaUID` y `terapeutaEmail` tras el login.
- **Rutas:** Todas definidas en `App.jsx` con React Router DOM v7.

---

## 11. Cómo agregar una nueva terapia

> Esta sección es la guía central para el desarrollador que va a integrar una nueva terapia. Se asume que la terapia ya existe en Firebase (sus colecciones de datos ya están creadas) y que se conoce su estructura de datos.

Para agregar una nueva terapia (llamémosla `XYZ` como ejemplo genérico) se deben tocar los siguientes archivos. El orden importa.

---

### Paso 1 — Crear la colección de detalles en Firestore

Firestore debe tener una colección llamada `ejercicios_XYZ` donde cada documento tenga el ID del ejercicio y los campos específicos de esa terapia.

El documento raíz en `ejercicios/{id}` debe tener `terapia: "XYZ"`.

---

### Paso 2 — Actualizar `exercisesService.js`

Este es el punto más crítico. Hay múltiples funciones que usan `if terapia === "VNEST" ... else if terapia === "SR"`. Todas deben contemplar `"XYZ"`.

**`getExerciseDetails(id, terapia)`**
```js
// ANTES:
const colName = terapia === "VNEST" ? "ejercicios_VNEST" : "ejercicios_SR";

// DESPUÉS:
const colMap = {
  VNEST: "ejercicios_VNEST",
  SR: "ejercicios_SR",
  XYZ: "ejercicios_XYZ",  // ← agregar aquí
};
const colName = colMap[terapia] || "ejercicios_VNEST";
```

**`deleteExercise(id, terapia)`**
```js
// Agregar el caso para XYZ:
else if (terapia === "XYZ")
  await deleteDoc(doc(db, "ejercicios_XYZ", id));
```

**Agregar nueva función de actualización para XYZ** (similar a `updateExerciseSR`):
```js
export async function updateExerciseXYZ(id, data) {
  const ref = doc(db, "ejercicios_XYZ", id);
  await updateDoc(ref, data);
}
```

---

### Paso 3 — Actualizar `patientService.js`

En `assignExerciseToPatient`, se lee el contexto del ejercicio según la terapia:

```js
// Agregar el caso XYZ:
} else if (tipo === "XYZ") {
  const subSnap = await getDoc(doc(db, "ejercicios_XYZ", exerciseId));
  if (subSnap.exists()) context = subSnap.data().contexto; // o el campo equivalente
}
```

---

### Paso 4 — Crear el componente de tabla para la biblioteca

Crear `src/components/exercises/XYZTable.jsx` y `XYZTable.css`.

Basarse en `VNESTTable.jsx` como plantilla. Los pasos clave:
1. Filtrar ejercicios por `e.terapia === "XYZ"`
2. Definir los filtros propios de XYZ (equivalentes a verbo/contexto en VNEST)
3. Definir las columnas de la tabla según los campos de `ejercicios_XYZ`
4. Recibir props: `exercises`, `onEdit`, `onView`

---

### Paso 5 — Crear el modal de visualización

Crear `src/components/exercises/XYZExerciseModal.jsx` y `XYZExerciseModal.css`.

Basarse en `VNESTExerciseModal.jsx`. Mostrar todos los campos específicos de XYZ. Recibe prop `exercise` (objeto con datos ya cargados) y `onClose`.

---

### Paso 6 — Crear el editor

Crear `src/components/editExercises/XYZEditor.jsx` y `XYZEditor.css`.

Basarse en `SREditor.jsx` (es el más simple). Los pasos clave:
1. En `useEffect`, cargar los datos con `getExerciseDetails(exercise.id, "XYZ")`
2. Construir el formulario con los campos de XYZ
3. En `handleSave`: actualizar `ejercicios_XYZ/{id}` directamente con `updateDoc` (o usar la función `updateExerciseXYZ` del Paso 2), y llamar `updateExercise(id, { revisado: form.revisado })`
4. Recibe props: `open`, `onClose`, `exercise`

---

### Paso 7 — Crear la vista de ejercicios del paciente (tab en PacienteDetail)

Crear `src/components/patients/PacienteXYZ.jsx` y `PacienteXYZ.css`.

Basarse en `PacienteSR.jsx`. Puntos clave:
1. Filtrar por `e.terapia === "XYZ"`
2. Definir filtros relevantes para XYZ
3. Definir columnas de la tabla
4. Recibe props: `exercises`, `onView`

---

### Paso 8 — Integrar en `EjerciciosTerapeuta.jsx` (Biblioteca)

Editar `src/components/exercises/EjerciciosTerapeuta.jsx`:

```jsx
// 1. Importar los nuevos componentes
import XYZTable from "./XYZTable";
import XYZExerciseModal from "./XYZExerciseModal";
import XYZEditor from "../editExercises/XYZEditor";

// 2. Agregar estado para el editor y visor de XYZ
const [showXYZEditor, setShowXYZEditor] = useState(false);
const [showXYZViewer, setShowXYZViewer] = useState(false);

// 3. En handleEdit, agregar el caso XYZ:
if (exercise.terapia === "XYZ") setShowXYZEditor(true);

// 4. En handleViewExercise, agregar el caso XYZ:
else if (exercise.terapia === "XYZ") setShowXYZViewer(true);

// 5. En el JSX, agregar el tab y la tabla:
<button onClick={() => setActiveTerapia("XYZ")}>XYZ</button>
{activeTerapia === "XYZ" && (
  <XYZTable exercises={exercises} onEdit={handleEdit} onView={handleViewExercise} />
)}

// 6. Agregar los modales al final del JSX:
{showXYZViewer && selectedExercise && (
  <XYZExerciseModal exercise={selectedExercise} onClose={() => setShowXYZViewer(false)} />
)}
{showXYZEditor && (
  <XYZEditor open={showXYZEditor} onClose={handleCloseEditor} exercise={selectedExercise} />
)}
```

---

### Paso 9 — Integrar en `PacienteDetail.jsx`

Editar `src/components/patients/PacienteDetail.jsx`:

```jsx
// 1. Importar nuevos componentes
import PacienteXYZ from "./PacienteXYZ";
import XYZExerciseModal from "../exercises/XYZExerciseModal";

// 2. Agregar estado
const [showXYZViewer, setShowXYZViewer] = useState(false);

// 3. En handleViewExercise, agregar el caso:
else if (exercise.terapia === "XYZ") setShowXYZViewer(true);

// 4. En el JSX, agregar el tab:
<button onClick={() => setActiveTerapia("XYZ")}>XYZ</button>

// 5. Agregar la vista del paciente bajo el tab:
{activeTerapia === "XYZ" && (
  <PacienteXYZ exercises={detailedExercises} onView={handleViewExercise} />
)}

// 6. Agregar el modal:
{showXYZViewer && selectedExercise && (
  <XYZExerciseModal exercise={selectedExercise} onClose={() => setShowXYZViewer(false)} />
)}
```

---

### Paso 10 — Actualizar `PatientAssignExercise.jsx`

En la búsqueda de ejercicios para asignar, el componente ya busca los detalles de VNEST y SR explícitamente. Si quieres que la búsqueda también examine campos de XYZ:

```jsx
// Agregar bloque de búsqueda en detalles XYZ (similar al bloque SR):
const xyzExercises = all.filter((e) => e.terapia === "XYZ");
for (const ex of xyzExercises) {
  const extras = await getExerciseDetails(ex.id, "XYZ");
  const detail = Array.isArray(extras) && extras.length > 0 ? extras[0] : extras || {};
  const combined = `${detail.campoImportante1 || ""} ${detail.campoImportante2 || ""}`.toLowerCase();
  if (combined.includes(termLower)) {
    detailedMatches.push({ ...ex, ...detail });
  }
}
```

---

### Paso 11 — Actualizar `EjerciciosTerapeuta.jsx` en la carga de detalles

En el bloque donde se enriquecen los ejercicios al cargar la biblioteca, hay un `if terapia === "VNEST" ... else if terapia === "SR"`. Agregar el caso XYZ:

```jsx
} else if (e.terapia === "XYZ") {
  return {
    ...e,
    campoClave1: extra.campoClave1 ?? e.campoClave1,
    campoClave2: extra.campoClave2 ?? e.campoClave2,
    pacienteEmail: patientEmail,
    pacienteNombre: patientName,
  };
}
```

---

### Resumen de archivos a crear/modificar

| Acción | Archivo |
|---|---|
| **Crear** | `src/components/exercises/XYZTable.jsx` |
| **Crear** | `src/components/exercises/XYZTable.css` |
| **Crear** | `src/components/exercises/XYZExerciseModal.jsx` |
| **Crear** | `src/components/exercises/XYZExerciseModal.css` |
| **Crear** | `src/components/editExercises/XYZEditor.jsx` |
| **Crear** | `src/components/editExercises/XYZEditor.css` |
| **Crear** | `src/components/patients/PacienteXYZ.jsx` |
| **Crear** | `src/components/patients/PacienteXYZ.css` |
| **Modificar** | `src/services/exercisesService.js` |
| **Modificar** | `src/services/patientService.js` |
| **Modificar** | `src/components/exercises/EjerciciosTerapeuta.jsx` |
| **Modificar** | `src/components/patients/PacienteDetail.jsx` |
| **Modificar** | `src/components/patients/PatientAssignExercise.jsx` |

> **No es necesario** modificar `App.jsx` (no hay rutas nuevas), `Navbar.jsx` (no hay sección nueva en el menú), ni `firebase.js` (la conexión ya está establecida).

---

*Documento de empalme elaborado en Marzo 2026. Basado en análisis completo del código fuente. Versión del proyecto: 0.0.0.*
