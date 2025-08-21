
const admin = require("firebase-admin");
const dotenv = require("dotenv");
dotenv.config();

// Read service account from FIREBASE_SERVICE_ACCOUNT env variable
let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccount) {
  try {
    serviceAccount = JSON.parse(serviceAccount);
    // Fix private_key newlines if needed
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (e) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON in .env');
  }
} else {
  throw new Error('FIREBASE_SERVICE_ACCOUNT env variable not set');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore(); // Firestore instance

/**
 * Send Password Reset Email
 */
const sendPasswordResetEmail = async (email) => {
  try {
    const link = await auth.generatePasswordResetLink(email);
    return { message: "Password reset link sent to email.", link };
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = { auth, db, sendPasswordResetEmail };
