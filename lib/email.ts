import nodemailer, { type Transporter } from "nodemailer";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporterPromise: Promise<Transporter> | undefined;

/**
 * SMTP transport from SMTP_* env vars. In development without SMTP_HOST it
 * falls back to an Ethereal test inbox and logs a preview URL for each email.
 */
async function createTransporter(): Promise<Transporter> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST) {
    const port = Number(SMTP_PORT ?? 587);

    return nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SMTP_HOST no está configurado");
  }

  const account = await nodemailer.createTestAccount();

  // eslint-disable-next-line no-console -- dev-only notice
  console.info(
    `[email] SMTP no configurado: usando Ethereal (${account.user})`,
  );

  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
}

function getTransporter() {
  transporterPromise ??= createTransporter().catch((error: unknown) => {
    transporterPromise = undefined;
    throw error;
  });

  return transporterPromise;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const from = process.env.EMAIL_SENDER || process.env.SMTP_USER;

  if (!from) throw new Error("EMAIL_SENDER no está configurado");

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: `Cast CRM <${from}>`,
    to,
    subject,
    html,
    text,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    // eslint-disable-next-line no-console -- Ethereal preview link for development
    console.info(`[email] "${subject}" para ${to}: ${previewUrl}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function actionEmail({
  name,
  intro,
  actionLabel,
  url,
}: {
  name: string;
  intro: string;
  actionLabel: string;
  url: string;
}) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);

  return {
    text: `Hola ${name},\n\n${intro}\n\n${url}\n\nSi no solicitaste esto, ignora este correo.`,
    html: `<p>Hola ${safeName},</p><p>${intro}</p><p><a href="${safeUrl}">${actionLabel}</a></p><p>Si no solicitaste esto, ignora este correo.</p>`,
  };
}
