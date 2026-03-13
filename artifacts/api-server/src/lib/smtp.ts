import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { siteSettingsTable } from "@workspace/db/schema";

async function getSmtpSettings() {
  const rows = await db.select().from(siteSettingsTable);
  const s: Record<string, string> = {};
  rows.forEach(r => { s[r.key] = r.value || ""; });
  return s;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const s = await getSmtpSettings();
  if (s["smtp_enabled"] !== "true" || !s["smtp_host"]) {
    throw new Error("SMTP chưa được cấu hình hoặc chưa bật");
  }

  const transporter = nodemailer.createTransport({
    host: s["smtp_host"],
    port: Number(s["smtp_port"] || "587"),
    secure: s["smtp_secure"] === "true",
    auth: {
      user: s["smtp_user"],
      pass: s["smtp_pass"],
    },
  });

  await transporter.sendMail({
    from: `"${s["smtp_from_name"] || "SMM Pro"}" <${s["smtp_from_email"] || s["smtp_user"]}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export async function testSmtp(toEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendEmail({
      to: toEmail,
      subject: "SMM Pro — Kiểm tra SMTP",
      html: `<h2>SMTP hoạt động!</h2><p>Nếu bạn nhận được email này, SMTP đã được cấu hình thành công trên SMM Pro.</p>`,
      text: "SMTP hoạt động! Cấu hình SMTP thành công trên SMM Pro.",
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
