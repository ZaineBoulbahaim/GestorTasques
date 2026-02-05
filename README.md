# T7 – Gestor de Tasques (Advanced Auth & RBAC)

Sistema d'alt rendiment per a la gestió de tasques, implementat amb **Node.js**, **Express** i **MongoDB**. Aquesta versió inclou un sistema avançat d'**Autorització Basada en Rols (RBAC)** amb permisos granulars i auditoria completa.

---

## 📋 Descripció del projecte

Aquesta API REST ofereix un marc de seguretat de nivell empresarial per a la gestió de tasques:

- **Autenticació robusta:** Mitjançant JWT amb xifratge de contrasenyes amb `bcrypt`.
- **RBAC Granular (Basat en Permisos):** Els usuaris no tenen només un "rol fix", sinó una col·lecció de permisos atòmics (ex: `tasks:create`, `audit:read`).
- **Sistema de Rols Dinàmics:** Possibilitat de gestionar rols (Admin, Editor, User, Viewer) i assignar-los permisos sense modificar el codi.
- **Registre d'Auditoria:** Totes les accions crítiques i els intents d'accés queden registrats per a un control total de seguretat.
- **Auto-Seeding:** El sistema es configura automàticament en arrencar, garantint que els permisos i rols base existeixin a la base de dades.

---

## 🛠 Tecnologies utilitzades

- **Node.js & Express**
- **MongoDB + Mongoose**
- **bcrypt** – Seguretat i xifratge de contrasenyes.
- **jsonwebtoken (JWT)** – Gestió de sessions i autenticació.
- **express-validator** – Validació i sanitització de dades.

---

## 📂 Estructura del projecte

```text
task-manager-api/
├── models/
│   ├── User.js
│   ├── Task.js
│   ├── Role.js            
│   ├── Permission.js      
│   └── AuditLog.js        
├── seeds/                 
│   ├── permissionSeed.js
│   └── roleSeed.js
├── middleware/
│   ├── auth.js            
│   ├── checkPermission.js 
│   └── roleCheck.js       
├── routes/
│   ├── authRoutes.js
│   ├── adminRoutes.js
│   └── taskRoutes.js
└── ...
```

# Documentació de Seguretat i Rutes - API Task Manager

## 🔐 Seguretat i Autorització

El sistema utilitza una arquitectura de seguretat de tres capes:

* **Autenticació:** El middleware `auth` verifica que el token JWT enviat a la capçalera sigui vàlid.
* **Autorització (RBAC):** El middleware `checkPermission("permis:accio")` verifica si el rol de l'usuari conté el permís específic necessari.
* **Auditoria:** Cada operació (crear, editar, eliminar o fallades d'accés) genera un registre automàtic al model `AuditLog`.


---

## 🔑 Rutes de l'API

### 👤 Autenticació (`/api/auth`)

| Mètode | Ruta | Descripció | Protegida |
| :--- | :--- | :--- | :---: |
| POST | `/register` | Registre de nou usuari | ❌ |
| POST | `/login` | Inici de sessió (Retorna JWT) | ❌ |
| POST | `/check-permission` | Verifica permisos per al frontend | ✅ |

### 📋 Tasques (`/api/tasks`)

| Mètode | Ruta | Permís Requerit |
| :--- | :--- | :--- |
| GET | `/` | `tasks:read` |
| POST | `/` | `tasks:create` |
| PUT | `/:id` | `tasks:update` |
| DELETE | `/:id` | `tasks:delete` |
| GET | `/stats` | `tasks:read` |

### 👑 Administració i Control (`/api/admin`)

| Mètode | Ruta | Descripció | Permís |
| :--- | :--- | :--- | :--- |
| GET | `/users/:id/permissions` | Veure permisos efectius d'un usuari | `users:read` |
| POST | `/roles` | Crear nous rols | `roles:manage` |
| POST | `/permissions` | Crear nous permisos | `permissions:manage` |
| GET | `/audit-logs` | Llistar historial d'activitat | `audit:read` |

---

## ⚙️ Instal·lació i Seed

### 1️⃣ Instal·lar dependències

```bash
npm install
```

## ⚙️ Configuració inicial (Seeding)

El sistema és **auto-gestionat**. En arrencar per primer cop, el servidor executa automàticament els scripts de càrrega inicial:

* **Permisos de Sistema:** Es creen les accions atòmiques per a tasques, usuaris, rols i auditoria.
* **Rols base:** Es generen els perfils predefinits (**Admin, User, Editor, Viewer**).
* **Protecció de dades:** Els permisos i rols crítics es marquen amb la propietat `isSystemRole: true` per evitar esborrats accidentals des de l'API.

```bash
# Comanda per arrencar el servidor i executar el seeding
npm run dev
```

## ❌ Gestió d'Errors i Auditoria
El sistema controla l'accés mitjançant respostes HTTP estandarditzades:

* **401 Unauthorized**: El token JWT és absent, ha caducat o és invàlid.

* **403 Forbidden**: L'usuari està autenticat correctament però el seu rol no té el permís necessari (Ex: un usuari amb rol user intentant accedir a /api/admin/audit-logs).

* **Respostes estandarditzades**: Totes les respostes de l'API mantenen una estructura consistent per facilitar la integració amb el frontend:

```bash
{
  "success": boolean,
  "data/message": any
}
```


## 👤 Autor  
**Zaine A.** Projecte acadèmic – DAW