const nodemailer = require("nodemailer");
require("dotenv").config();

console.log("Env Vars:", {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS?.substring(0, 5) + "...",
  from: process.env.SMTP_FROM,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.sendgrid.net",
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "apikey",
    pass: process.env.SMTP_PASS || "SG.your_working_api_key_here",
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("Transporter verification failed:", error);
  } else {
    console.log("Transporter verified successfully:", success);
  }
});

exports.sendOTP = async (email, otp) => {
  console.log(`Attempting to send OTP to ${email} with OTP: ${otp}`);
  const mailOptions = {
    from: process.env.SMTP_FROM || "support@yourdomain.com",
    to: "saumyakant4421@gmail.com",
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


async function testSend() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'apikey',
      pass: process.env.SMTP_PASS || 'SG.your_working_api_key_here',
    },
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error('Transporter verification failed:', error);
    } else {
      console.log('Transporter verified successfully:', success);
    }
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'streamverse.co@gmail.com',
      to: 'hellenginnering@gmail.com', // Verify this email
      subject: 'Test Email',
      text: 'This is a test to verify SMTP.',
    });
    console.log('Test email sent:', info.response);
  } catch (error) {
    console.error('Send failed:', error);
  }
}

testSend(); // Uncomment this line

// testSend();
