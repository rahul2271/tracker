import nodemailer from "nodemailer";

// Optional: for Next.js App Router, you can add this
export const dynamic = "force-dynamic"; // Enables dynamic response caching (optional)

export async function POST(request) {
  try {
    const body = await request.json();

    const { email, medicineName, dose, time } = body;

    // Basic field validation
    if (!email || !medicineName || !dose || !time) {
      console.error("Missing fields:", { email, medicineName, dose, time });
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const subject = `Reminder: Time to take your medicine (${medicineName})`;
    const text = `This is a reminder to take your medicine:\n\nMedicine: ${medicineName}\nDose: ${dose}\nScheduled Time: ${time}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>🕒 Medicine Reminder</h2>
        <p><strong>Medicine:</strong> ${medicineName}</p>
        <p><strong>Dose:</strong> ${dose}</p>
        <p><strong>Scheduled Time:</strong> ${time}</p>
        <p>Stay healthy,<br/>Yukti Herbs</p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Yukti Herbs" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text,
      html,
    });

    console.log(`✅ Email sent to ${email}: ${info.messageId}`);

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Email failed", error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
