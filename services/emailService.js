const nodemailer = require("nodemailer");
require("dotenv").config();


exports.sendOTP = async (email, otp) => {
  console.log(`Attempting to send OTP to ${email} with OTP: ${otp}`);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error("Transporter verification failed:", error);
    } else {
      console.log("Transporter verified successfully:", success);
    }
  });

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: email, // Dynamic recipient from the caller
    subject: "Your OTP Code",
    text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP email sent:", info.response);
    return info;
  } catch (error) {
    console.error("Failed to send OTP:", error);
    throw error;
  }
};
