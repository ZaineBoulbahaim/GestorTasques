#  Task Manager API (JWT Avançat + Jerarquia de Rols)

Sistema avançat de gestió de tasques desenvolupat amb **Node.js**, **Express** i **MongoDB**, enfocat en la seguretat, escalabilitat i control d'accés professional.

Aquesta versió implementa:

- 🔐 JWT Avançat (Access Token + Refresh Token)
- 🏛️ Jerarquia de Rols amb herència
- 🤝 Delegació temporal de permisos
- 📊 Auditoria avançada
- ⚡ Rate limiting per rol
- 🛡️ Seguretat HTTP amb Helmet i CORS
- 🚫 Blacklist de tokens per logout segur

---

# 📋 Descripció del projecte

L'objectiu del projecte és crear una API REST professional amb un sistema complet d'autenticació i autorització avançada.

El sistema permet:

- Gestionar tasques amb permisos granulars
- Gestionar usuaris, rols i permisos
- Delegar permisos temporalment entre usuaris
- Registrar totes les accions importants
- Aplicar seguretat avançada a nivell HTTP i autenticació

---

# 🚀 Característiques principals

## 🔐 JWT Avançat

El sistema utilitza dos tipus de tokens:

### Access Token
- Durada curta (15 minuts)
- S'utilitza per accedir a recursos protegits
- Menor risc en cas de robatori

### Refresh Token
- Durada llarga (7 dies)
- Permet renovar l'access token
- Es guarda en blacklist al logout

---

## 🏛️ Jerarquia de Rols

Els rols tenen herència de permisos.

```text
SUPER_ADMIN
   └── ADMIN
         └── MANAGER
               └── USER
                     └── VIEWER


## 🏛️ Jerarquia de Rols

El sistema implementa herència de permisos entre rols:

```bash
SUPER_ADMIN
   └── ADMIN
         └── MANAGER
               └── USER
                     └── VIEWER
```

Exemple:

```bash
ADMIN hereta permisos de MANAGER

MANAGER hereta permisos de USER

USER hereta permisos de VIEWER
```

Això evita duplicació de permisos i facilita el manteniment.

---

## 🤝 Delegació de Permisos

Els usuaris poden delegar permisos temporalment.

Exemple:

```bash
Un manager pot delegar tasks:assign

La delegació té data d'expiració

El sistema revoca automàticament permisos expirats
```

---

## 📊 Auditoria Avançada

Es registren:

```bash
- Accions realitzades
- Usuari que les fa
- IP
- User Agent
- Canvis realitzats
- Estat de l'acció
```

Exemple:

```json
{
  "action": "tasks:update",
  "status": "success",
  "ipAddress": "192.168.1.10"
}
```

---

## ⚡ Rate Limiting per Rol

Cada rol té límits diferents:

| Rol | Límit |
|------|--------|
| SUPER_ADMIN | 1000 req/min |
| ADMIN | 500 req/min |
| MANAGER | 200 req/min |
| USER | 100 req/min |
| VIEWER | 50 req/min |

---

## 🛠 Tecnologies utilitzades

```bash
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcrypt
- Helmet
- CORS
- express-rate-limit
- dotenv
```

---

## 📂 Estructura del projecte

```bash
projecte-t9/
│
├── src/
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── taskController.js
│   │   ├── roleController.js
│   │   ├── permissionController.js
│   │   ├── delegationController.js
│   │   ├── userController.js
│   │   └── auditController.js
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── auditMiddleware.js
│   │   ├── roleMiddleware.js
│   │   └── rateLimiter.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Role.js
│   │   ├── Permission.js
│   │   ├── Task.js
│   │   ├── Delegation.js
│   │   ├── AuditLog.js
│   │   └── TokenBlacklist.js
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── taskRoutes.js
│   │   ├── roleRoutes.js
│   │   ├── permissionRoutes.js
│   │   ├── delegationRoutes.js
│   │   ├── userRoutes.js
│   │   └── auditRoutes.js
│   │
│   ├── services/
│   │   └── delegationService.js
│   │
│   └── utils/
│       ├── errorResponse.js
│       ├── seedPermissions.js
│       └── seedRoles.js
│
├── uploads/
├── .env
├── package.json
└── README.md
```

---

## 🔑 Autenticació

### Login

```bash
POST /api/auth/login
```

Body:

```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

Resposta:

```json
{
  "accessToken": "xxxxx.yyyyy.zzzzz",
  "refreshToken": "aaaaa.bbbbb.ccccc",
  "expiresIn": 900
}
```

---

### Refresh Token

```bash
POST /api/auth/refresh
```

Body:

```json
{
  "refreshToken": "aaaaa.bbbbb.ccccc"
}
```

---

### Logout

```bash
POST /api/auth/logout
```

El sistema:

```bash
- revoca access token
- revoca refresh token
- afegeix tokens a blacklist
```

---

## 🔑 Rutes principals

### 🔐 Auth

| Mètode | Ruta |
|--------|-------|
| POST | /api/auth/register |
| POST | /api/auth/login |
| POST | /api/auth/refresh |
| POST | /api/auth/logout |

---

### 📋 Tasks

| Mètode | Ruta |
|--------|-------|
| GET | /api/tasks |
| POST | /api/tasks |
| PUT | /api/tasks/:id |
| DELETE | /api/tasks/:id |
| GET | /api/tasks/stats |

---

### 👥 Users

| Mètode | Ruta |
|--------|-------|
| GET | /api/users |
| GET | /api/users/:id |
| PUT | /api/users/:id |
| DELETE | /api/users/:id |
| GET | /api/users/:id/permissions |

---

### 🎭 Roles

| Mètode | Ruta |
|--------|-------|
| GET | /api/roles |
| GET | /api/roles/:id |
| POST | /api/roles |
| PUT | /api/roles/:id |
| DELETE | /api/roles/:id |
| GET | /api/roles/:id/hierarchy |
| GET | /api/roles/:id/permissions |

---

### 🔑 Permissions

| Mètode | Ruta |
|--------|-------|
| GET | /api/permissions |
| GET | /api/permissions/:id |
| POST | /api/permissions |
| PUT | /api/permissions/:id |
| DELETE | /api/permissions/:id |

---

### 🤝 Delegations

| Mètode | Ruta |
|--------|-------|
| GET | /api/delegations |
| GET | /api/delegations/:id |
| POST | /api/delegations |
| DELETE | /api/delegations/:id |
| GET | /api/delegations/user/:userId |

---

### 📊 Audit

| Mètode | Ruta |
|--------|-------|
| GET | /api/audit/logs |
| GET | /api/audit/stats |
| GET | /api/audit/stats/user/:userId |

---

## 🔒 Seguretat implementada

### Helmet

Protecció de headers HTTP:

```bash
- CSP
- HSTS
- X-Frame-Options
- etc.
```

---

### CORS

Configuració d'orígens permesos:

```js
origin: process.env.CLIENT_URL || "*"
```

---

### Rate Limiting

Protecció davant:

```bash
- spam
- brute force
- abusos d'API
```

---

### Token Blacklist

Els tokens revocats:

```bash
- no poden reutilitzar-se
- s'emmagatzemen temporalment
- s'eliminen automàticament en expirar
```

---

## ⚙️ Instal·lació

### 1️⃣ Instal·lar dependències

```bash
npm install
```

---

### 2️⃣ Configurar `.env`

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/taskmanager
JWT_SECRET=supersecret
CLIENT_URL=http://localhost:5173
```

---

### 3️⃣ Executar projecte

```bash
npm run dev
```

---

## 🌱 Seeding automàtic

En iniciar el servidor:

```bash
- es creen permisos base
- es creen rols base
- es genera jerarquia inicial
```

Ordre:

```bash
1. Permissions
2. Roles
```

---

## 🧪 Testing amb Postman

El projecte inclou proves de:

```bash
- autenticació
- jerarquia
- permisos
- delegacions
- auditoria
- seguretat
```

Total aproximat:

```bash
✅ 51 proves realitzades
```

---

## ❌ Gestió d'Errors

### 401 Unauthorized

```bash
Token invàlid o expirat.
```

### 403 Forbidden

```bash
Usuari sense permisos.
```

### 404 Not Found

```bash
Ruta no trobada.
```

### 429 Too Many Requests

```bash
Límit de peticions excedit.
```

---

## 📌 Exemple de resposta estàndard

```json
{
  "success": true,
  "message": "Operació correcta",
  "data": {}
}
```

---

## 👤 Autor

```bash
Zaine A.
Projecte acadèmic – DAW
```