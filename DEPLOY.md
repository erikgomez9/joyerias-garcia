# Desplegar Joyerías García en la nube

Stack: **Vercel** (app React) + **Render** (API Express) + **MongoDB Atlas** (base de datos).

## Requisitos

- Cuenta en [GitHub](https://github.com)
- Cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (ya la usas)
- Cuenta en [Render](https://render.com) (API)
- Cuenta en [Vercel](https://vercel.com) (front)

**Importante:** no subas `server/.env` a Git. Usa las variables en el panel de cada servicio.

---

## 1. MongoDB Atlas

1. En **Network Access**, permite acceso desde internet: **Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`) para que Render pueda conectar. (La seguridad va por usuario/contraseña de la URI.)
2. Copia la cadena **MONGODB_URI** (la misma que en tu `server/.env` local).

---

## 2. Subir código a GitHub

Si aún no tienes repo:

```bash
cd /Users/fabiangarciapichardo/Desktop/JOYERIAS_GARCIA
git init
git add .
git commit -m "Preparar despliegue Vercel + Render"
git branch -M main
gh repo create joyerias-garcia --private --source=. --push
```

(Si ya tienes remoto, solo `git push`.)

---

## 3. API en Render

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**.
2. Conecta el repo de GitHub.
3. Configuración:
   - **Root Directory:** `server` (obligatorio; si queda vacío, Render ejecuta `npm run build` del front y falla)
   - **Runtime:** Node
   - **Build Command:** `npm install` (no uses `npm run build` de la raíz)
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/v1/health`
4. **Environment Variables:**
   - `MONGODB_URI` = tu cadena Atlas
   - `CORS_ORIGIN` = lo llenarás después del paso 4 (URL de Vercel), por ejemplo:  
     `https://joyerias-garcia.vercel.app`
5. **Create Web Service**. Anota la URL pública, ej.:  
   `https://joyerias-garcia-api.onrender.com`
6. Prueba en el navegador:  
   `https://TU-API.onrender.com/api/v1/health`  
   Debe responder `{"ok":true,"mongo":"connected"}`.

*(Opcional: **New → Blueprint** y selecciona el repo; Render lee `render.yaml`.)*

**Nota:** el plan gratis de Render “duerme” la API; la primera petición del día puede tardar ~30 s.

---

## 4. Front en Vercel

1. [Vercel](https://vercel.com) → **Add New Project** → importa el mismo repo.
2. **Framework Preset:** Vite (detectado).
3. **Root Directory:** `.` (raíz del repo).
4. **Environment Variables** (Production):
   - `VITE_API_BASE` = `https://TU-API.onrender.com/api/v1`  
     (la URL de Render del paso 3, con `/api/v1` al final)
5. **Deploy**. Anota la URL, ej.: `https://joyerias-garcia.vercel.app`.

---

## 5. Cerrar el círculo (CORS)

1. Vuelve a **Render** → tu servicio → **Environment**.
2. Edita `CORS_ORIGIN` con la URL exacta de Vercel (sin barra final). Si usas preview y producción:
   ```
   https://joyerias-garcia.vercel.app,https://joyerias-garcia-xxx.vercel.app
   ```
3. **Save Changes** (Render redeploy).

---

## 6. Probar en tienda

1. Abre la URL de Vercel en el celular o PC.
2. Panel → debe decir **MongoDB conectado** (no “Modo local”).
3. Prueba inventario, POS o un pedido de prueba.

Rutas con hash: `https://tu-app.vercel.app/#/dashboard`

---

## 7. Dominio propio (opcional)

- **Vercel:** Settings → Domains → añade `app.tudominio.com`.
- **Render:** Settings → Custom Domain → `api.tudominio.com`.
- Actualiza `VITE_API_BASE` y `CORS_ORIGIN` con esas URLs y redeploy.

---

## Variables de referencia

| Dónde   | Variable         | Ejemplo |
|---------|------------------|---------|
| Render  | `MONGODB_URI`    | `mongodb+srv://...` |
| Render  | `CORS_ORIGIN`    | `https://tu-app.vercel.app` |
| Vercel  | `VITE_API_BASE`  | `https://tu-api.onrender.com/api/v1` |

Local sigue igual: `server/.env` + `npm run dev:all` (proxy Vite, sin `VITE_API_BASE`).

---

## Seguridad (siguiente paso recomendado)

La app en internet debería tener **login** antes de uso público prolongado. Mientras tanto, no compartas la URL de Vercel en redes abiertas.

Si alguna contraseña de MongoDB estuvo en un chat o repo por error, **rota la contraseña** en Atlas → Database Access.
