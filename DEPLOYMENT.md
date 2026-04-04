# Guía de Despliegue — RehabilitIA Web

Esta guía cubre el proceso completo: construir la imagen Docker, subirla a Docker Hub y desplegarla en la máquina virtual Ubuntu de la universidad para que la app esté disponible 24/7.

---

## Índice

1. [Prerequisitos](#1-prerequisitos)
2. [Parte 1 — Construir y subir a Docker Hub (desde Windows)](#2-parte-1--construir-y-subir-a-docker-hub-desde-windows)
3. [Parte 2 — Configurar la VM Ubuntu y ejecutar el contenedor](#3-parte-2--configurar-la-vm-ubuntu-y-ejecutar-el-contenedor)
4. [Parte 3 — Acceso externo desde internet](#4-parte-3--acceso-externo-desde-internet)
5. [Actualizar la imagen (nuevos despliegues)](#5-actualizar-la-imagen-nuevos-despliegues)
6. [Comandos útiles de mantenimiento](#6-comandos-útiles-de-mantenimiento)

---

## 1. Prerequisitos

### En tu máquina Windows (desarrollo)
- **Docker Desktop** instalado y corriendo → https://www.docker.com/products/docker-desktop/
- **Cuenta en Docker Hub** → https://hub.docker.com  
  Anota tu nombre de usuario, se usa como `TU_USUARIO` en todos los comandos.

### En la VM Ubuntu (ya proporcionada)
- IP: `10.43.101.11` | Usuario: `estudiante` | Puerto SSH: `22`
- Conectarse: `ssh estudiante@10.43.101.11`

---

## 2. Parte 1 — Construir y subir a Docker Hub (desde Windows)

> Ejecuta estos comandos en PowerShell o CMD **desde la raíz del proyecto**.

### Paso 1 — Iniciar sesión en Docker Hub

```powershell
docker login
# Ingresa tu usuario y contraseña de Docker Hub
```

### Paso 2 — Construir la imagen de producción

```powershell
docker build -t TU_USUARIO/rehabilitia:latest .
```

La build hace lo siguiente internamente:
- **Stage 1 (builder):** instala dependencias Node y ejecuta `npm run build` → genera `/dist`
- **Stage 2 (production):** copia `/dist` a nginx:alpine → imagen final ~25 MB

Si quieres etiquetarla con versión:

```powershell
docker build -t TU_USUARIO/rehabilitia:v1.0 -t TU_USUARIO/rehabilitia:latest .
```

### Paso 3 — Verificar la imagen localmente (opcional)

```powershell
docker run -d -p 8080:80 --name test-rehabilitia TU_USUARIO/rehabilitia:latest
# Abre http://localhost:8080 en el navegador
docker stop test-rehabilitia ; docker rm test-rehabilitia
```

### Paso 4 — Subir a Docker Hub

```powershell
docker push TU_USUARIO/rehabilitia:latest
# Si también etiquetaste con versión:
docker push TU_USUARIO/rehabilitia:v1.0
```

La imagen quedará en `https://hub.docker.com/r/TU_USUARIO/rehabilitia`.

---

## 3. Parte 2 — Configurar la VM Ubuntu y ejecutar el contenedor

Conéctate a la VM por SSH:

```bash
ssh estudiante@10.43.101.11
```

### Paso 1 — Instalar Docker Engine en Ubuntu

```bash
# Actualizar paquetes
sudo apt-get update

# Instalar dependencias
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Agregar clave GPG oficial de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Agregar el repositorio de Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verificar instalación
sudo docker --version
sudo docker compose version
```

### Paso 2 — Permitir usar Docker sin sudo (opcional pero cómodo)

```bash
sudo usermod -aG docker estudiante
# Cierra sesión y vuelve a conectarte por SSH para que tome efecto
exit
ssh estudiante@10.43.101.11
```

### Paso 3 — Habilitar Docker para que inicie automáticamente con la VM

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

### Paso 4 — Crear el directorio de la app y el archivo docker-compose

```bash
mkdir -p ~/rehabilitia
cd ~/rehabilitia
```

Crea el archivo `docker-compose.yml` en la VM:

```bash
cat > docker-compose.yml << 'EOF'
services:
  rehabilitia-web:
    image: TU_USUARIO/rehabilitia:latest
    container_name: rehabilitia-web
    restart: always
    ports:
      - "80:80"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
EOF
```

> **Reemplaza `TU_USUARIO`** con tu usuario real de Docker Hub antes de ejecutar.

### Paso 5 — Configurar el firewall de la VM (ufw)

```bash
# Abrir puertos HTTP y SSH (SSH debe estar ya abierto por defecto)
sudo ufw allow 22/tcp    # SSH — imprescindible no bloquearlo
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (para cuando se configure SSL)
sudo ufw enable
sudo ufw status
```

### Paso 6 — Descargar y ejecutar el contenedor

```bash
cd ~/rehabilitia
docker compose pull          # descarga la imagen desde Docker Hub
docker compose up -d         # inicia en segundo plano
docker compose ps            # verifica que esté "healthy"
```

La app estará disponible en **`http://10.43.101.11`** desde la red interna de la universidad.

### Paso 7 — Verificar que funciona

```bash
curl http://localhost/health
# Debe responder: healthy
```

---

## 4. Parte 3 — Acceso externo desde internet

La VM tiene IP **privada** (`10.43.101.11`), lo que significa que sólo es accesible dentro de la red universitaria. Para exponerla a internet hay dos caminos:

---

### Opción A — Cloudflare Tunnel ⭐ (Recomendado)

Es **gratuito**, no requiere intervención del departamento de TI, proporciona **HTTPS automático** y funciona incluso detrás de firewalls restrictivos. La app queda disponible en una URL pública tipo `https://rehabilitia.tunelpropio.cfargotunnel.com`.

#### Instalación en la VM

```bash
# Descargar cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

#### Crear el túnel (se hace una sola vez)

```bash
# Iniciar sesión en Cloudflare (abrirá una URL en consola para autenticarte en el navegador)
cloudflared tunnel login

# Crear el túnel y darle un nombre
cloudflared tunnel create rehabilitia-tunnel
# Guarda el TunnelID que te muestra (formato UUID)

# Crear el archivo de configuración
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: TUNNEL_ID_AQUI
credentials-file: /home/estudiante/.cloudflared/TUNNEL_ID_AQUI.json

ingress:
  - hostname: TU_SUBDOMINIO.TU_DOMINIO.com
    service: http://localhost:80
  - service: http_status:404
EOF
```

> Si no tienes dominio propio, Cloudflare asigna uno gratuito `*.trycloudflare.com` de forma temporal usando:
> ```bash
> cloudflared tunnel --url http://localhost:80
> # Te mostrará una URL pública directamente, sin cuenta
> ```

#### Ejecutar como servicio (permanente)

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

---

### Opción B — Port Forwarding por el equipo de TI (si tienes dominio/IP pública asignada)

Si el departamento de TI de la universidad puede configurar el router/firewall:

1. **Solicitar** que se redirija el tráfico de la IP pública de la universidad en:
   - Puerto `80` → `10.43.101.11:80`
   - Puerto `443` → `10.43.101.11:443` (para HTTPS futuro)

2. La app quedará accesible en `http://IP_PUBLICA_UNIVERSIDAD`

3. Para agregar HTTPS con certificado gratuito (Let's Encrypt), instala Certbot después de tener un dominio apuntando a esa IP pública:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

### Opción C — ngrok (para pruebas rápidas, no permanente)

```bash
# Instalar ngrok
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc > /dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt-get update && sudo apt-get install ngrok

# Usar (requiere cuenta gratuita en ngrok.com para obtener el token)
ngrok config add-authtoken TU_TOKEN_NGROK
ngrok http 80
```

⚠️ Las URLs de ngrok cambian en cada restart en el plan gratuito y tienen limitación de conexiones simultáneas. **No usar para producción.**

---

## 5. Actualizar la imagen (nuevos despliegues)

Cada vez que haya cambios en el código:

### Desde Windows — construir y subir nueva versión

```powershell
docker build -t TU_USUARIO/rehabilitia:latest .
docker push TU_USUARIO/rehabilitia:latest
```

### En la VM — descargar y reiniciar

```bash
cd ~/rehabilitia
docker compose pull          # descarga la nueva imagen
docker compose up -d         # reinicia con la versión nueva (zero-downtime ~2s)
```

---

## 6. Comandos útiles de mantenimiento

```bash
# Ver estado del contenedor
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Ver últimas 100 líneas de log
docker compose logs --tail=100

# Reiniciar el contenedor
docker compose restart

# Detener
docker compose down

# Detener y eliminar imagen local
docker compose down --rmi all

# Entrar al shell del contenedor (debug)
docker exec -it rehabilitia-web sh

# Ver uso de recursos
docker stats rehabilitia-web

# Ver el estado de salud
docker inspect --format='{{.State.Health.Status}}' rehabilitia-web
```

---

## Estructura de archivos Docker

| Archivo | Propósito |
|---|---|
| `Dockerfile` | Build multi-stage: Node (compilar) → nginx:alpine (servir) |
| `.dockerignore` | Excluye `node_modules`, `.git`, etc. del contexto de build |
| `nginx.conf` | Configuración nginx: React Router, gzip, cache, headers de seguridad |
| `docker-compose.yml` | Orquestación para la VM (`restart: always`, puerto 80) |
