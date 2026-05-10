import nodemailer from "nodemailer";

/**
 * SERVEI D'EMAIL (emailService)
 *
 * Gestiona l'enviament d'emails transaccionals:
 *   - Recuperació de contrasenya (forgot password)
 *
 * Configuració via variables d'entorn:
 *   EMAIL_HOST     → servidor SMTP (ex: smtp.mailtrap.io)
 *   EMAIL_PORT     → port SMTP (ex: 587)
 *   EMAIL_USER     → usuari SMTP
 *   EMAIL_PASS     → contrasenya SMTP
 *   EMAIL_FROM     → adreça remitent (ex: noreply@taskmanager.com)
 *   CLIENT_URL     → URL del frontend (ex: http://localhost:5173)
 *
 * Per a desenvolupament es recomana Mailtrap (mailtrap.io):
 *   - Captura els emails sense enviar-los realment
 *   - Permet veure el contingut al panel web
 *
 * Si NO hi ha config d'email, el token es mostra per consola
 * per poder fer les proves de Postman igualment.
 */

// ─── CREAR TRANSPORT ────────────────────────────────────────────────────────

/**
 * createTransporter()
 * Crea el transport de nodemailer segons les variables d'entorn.
 * Retorna null si no hi ha configuració.
 */
const createTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: parseInt(process.env.EMAIL_PORT) === 465, // true per port 465 (SSL)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ─── ENVIAR EMAIL DE RESET ───────────────────────────────────────────────────

/**
 * sendPasswordResetEmail(email, name, rawToken)
 * Envia l'email de recuperació de contrasenya amb l'enllaç de reset.
 *
 * L'enllaç té el format:
 *   {CLIENT_URL}/reset-password/{rawToken}
 *
 * Si no hi ha config d'email, mostra el token per consola
 * (mode desenvolupament sense SMTP).
 *
 * @param {String} email    - Adreça de destí
 * @param {String} name     - Nom de l'usuari (per personalitzar)
 * @param {String} rawToken - Token en clar generat per PasswordReset.createResetToken()
 */
const sendPasswordResetEmail = async (email, name, rawToken) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const resetUrl = `${clientUrl}/reset-password/${rawToken}`;
  const expirationMinutes = 60;

  // ── Mode consola (sense SMTP configurat) ─────────────────────────────────
  const transporter = createTransporter();
  if (!transporter) {
    console.log("\n📧 [EMAIL SERVICE - MODE CONSOLA]");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📬 Per a: ${email}`);
    console.log(`🔗 URL de reset: ${resetUrl}`);
    console.log(`🎫 Token raw (per Postman): ${rawToken}`);
    console.log(`⏱️  Expira en: ${expirationMinutes} minuts`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { success: true, mode: "console", token: rawToken };
  }

  // ── Mode SMTP real ────────────────────────────────────────────────────────
  const mailOptions = {
    from: `"Task Manager" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: "Recuperació de contrasenya - Task Manager",
    // Versió text plà (per clients que no suporten HTML)
    text: `
Hola ${name || "usuari"},

Has sol·licitat recuperar la teva contrasenya.

Fes clic a l'enllaç següent per restablir-la:
${resetUrl}

Aquest enllaç és vàlid durant ${expirationMinutes} minuts.

Si no has sol·licitat aquest canvi, ignora aquest email.

Equip de Task Manager
    `.trim(),

    // Versió HTML
    html: `
<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperació de contrasenya</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { color: #333; font-size: 22px; margin: 0; }
    .btn { display: inline-block; background: #4f46e5; color: #fff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .info { background: #f0f0f0; border-radius: 4px; padding: 12px; font-size: 13px; color: #666; word-break: break-all; }
    .footer { margin-top: 24px; font-size: 12px; color: #999; text-align: center; }
    .warning { color: #e53e3e; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Recuperació de contrasenya</h1>
    </div>
    <p>Hola <strong>${name || "usuari"}</strong>,</p>
    <p>Has sol·licitat restablir la teva contrasenya. Fes clic al botó per continuar:</p>
    <div style="text-align:center">
      <a href="${resetUrl}" class="btn">Restablir contrasenya</a>
    </div>
    <p>O copia aquest enllaç al navegador:</p>
    <div class="info">${resetUrl}</div>
    <p class="warning">⏱️ Aquest enllaç expira en <strong>${expirationMinutes} minuts</strong>.</p>
    <p class="warning">Si no has sol·licitat aquest canvi, ignora aquest email. La teva contrasenya no canviarà.</p>
    <div class="footer">Task Manager API — Missatge automàtic, no respondis.</div>
  </div>
</body>
</html>
    `.trim(),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Email de reset enviat a ${email} (ID: ${info.messageId})`);
  return { success: true, mode: "smtp", messageId: info.messageId };
};

// ─── EXPORTACIÓ ─────────────────────────────────────────────────────────────

const emailService = {
  sendPasswordResetEmail,
};

export default emailService;