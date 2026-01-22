const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL } =
  process.env;

const sendEmail = async (email, subject, bodyPart, attachments = []) => {
  let transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: true,
    auth: {
      user: SMTP_USER || "apikey",
      pass: SMTP_PASSWORD,
    },
    logger: true,
    debug: true,
  });

  let info = await transporter.sendMail({
    from: `Ship Logic" <${FROM_EMAIL}>`,
    to: email,
    subject: subject,
    html: bodyPart,
    attachments: attachments,
  });

  console.log(`Email sent: ${info.messageId}`);
  return { success: true, messageId: info.messageId };
};

export { sendEmail };
