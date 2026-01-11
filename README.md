# T7 – Gestor de Tasques

Sistema complet d'autenticació i autorització per a una API de gestió de tasques, implementat amb **Node.js**, **Express** i **MongoDB**, utilitzant **JWT (JSON Web Tokens)** i un sistema de rols (`user` i `admin`).

---

## 📋 Descripció del projecte

Aquest projecte implementa una API REST segura que permet:

- Registrar i autenticar usuaris
- Gestionar tasques associades a cada usuari
- Protegir totes les rutes mitjançant JWT
- Aplicar autorització basada en rols
- Permetre funcionalitats avançades per a administradors

Cada usuari només pot accedir i modificar les seves pròpies tasques, mentre que els administradors tenen accés global al sistema.

---

## 🛠 Tecnologies utilitzades

- **Node.js**
- **Express**
- **MongoDB + Mongoose**
- **bcrypt** – xifrat de contrasenyes
- **jsonwebtoken (JWT)** – autenticació
- **express-validator** – validació d'entrades
- **dotenv** – gestió de variables d'entorn

---

## 📂 Estructura del projecte

```
task-manager-api/
├── .env.example
├── models/
│   ├── User.js
│   └── Task.js
├── controllers/
│   ├── authController.js
│   ├── adminController.js
│   └── taskController.js
├── middleware/
│   ├── auth.js
│   ├── roleCheck.js
│   └── validators/
│       ├── authValidators.js
│       └── taskValidators.js
├── routes/
│   ├── authRoutes.js
│   ├── adminRoutes.js
│   └── taskRoutes.js
├── utils/
│   ├── generateToken.js
│   └── errorResponse.js
├── app.js
└── package.json
```

---

## ⚙️ Instal·lació i configuració

### 1️⃣ Instal·lar dependències

```bash
npm install
```

### 2️⃣ Variables d'entorn

Crear un fitxer `.env` basat en `.env.example`:

```env
JWT_SECRET=clau_secreta_molt_segura
JWT_EXPIRES_IN=7d
MONGO_URI=mongodb://localhost:27017/taskmanager
```

⚠️ **No pujar mai el fitxer `.env` al repositori**

### 3️⃣ Executar el servidor

```bash
npm run dev
```

---

## 🔐 Autenticació i seguretat

- Contrasenyes xifrades amb **bcrypt** (cost ≥ 10)
- Autenticació mitjançant **JWT**
- Tokens amb expiració
- Middleware d'autenticació per a rutes protegides
- Middleware de control de rols (`user` / `admin`)
- Validació i sanitització de totes les entrades

---

## 🔑 Rutes d'autenticació (`/api/auth`)

| Mètode | Ruta | Descripció | Protegida |
|------|------|-----------|-----------|
| POST | /register | Registrar usuari | ❌ |
| POST | /login | Iniciar sessió | ❌ |
| GET | /me | Perfil de l'usuari | ✅ |
| PUT | /profile | Actualitzar perfil | ✅ |
| PUT | /change-password | Canviar contrasenya | ✅ |

---

## 📋 Rutes de tasques (`/api/tasks`)

🔒 **Totes protegides** – només accés a tasques pròpies

| Mètode | Ruta | Descripció |
|------|------|-----------|
| GET | / | Obtenir tasques de l'usuari |
| POST | / | Crear tasca |
| GET | /:id | Obtenir tasca per ID |
| PUT | /:id | Actualitzar tasca |
| DELETE | /:id | Eliminar tasca |
| GET | /stats | Estadístiques de l'usuari |

---

## 👑 Rutes d'administració (`/api/admin`)

🔐 **Només per a admins**

| Mètode | Ruta | Descripció |
|------|------|-----------|
| GET | /users | Llistar usuaris |
| GET | /tasks | Llistar totes les tasques |
| DELETE | /users/:id | Eliminar usuari |
| PUT | /users/:id/role | Canviar rol |

---

## 🧪 Proves

El projecte s'ha provat amb **Postman**, incloent:

- Registre i login
- Accés amb i sense token
- Errors de validació
- Accés indegut a recursos
- Funcionalitats d'admin

---

## ❌ Gestió d'errors

- 400 – Errors de validació
- 401 – No autoritzat (token absent o invàlid)
- 403 – Prohibit (rol insuficient)
- 404 – Recurs no trobat
- 500 – Error del servidor

Respostes estandarditzades mitjançant `ErrorResponse`

---

## ✅ Bones pràctiques aplicades

- Separació de responsabilitats
- Middleware reutilitzable
- No exposar dades sensibles
- Control d'accés per propietat
- Ús de variables d'entorn
- Codi comentat i estructurat

---

## 🚀 Funcionalitats futures (opcionals)

- Refresh tokens
- Verificació d'email
- Recuperació de contrasenya
- Historial d'activitat
- 2FA
- Blacklist de tokens

---

## 📚 Recursos

- https://jwt.io
- https://www.npmjs.com/package/bcrypt
- https://express-validator.github.io/
- OWASP Authentication Cheat Sheet

---

## 👤 Autor

**Zaine A.**  
Projecte acadèmic – DAW

---  
