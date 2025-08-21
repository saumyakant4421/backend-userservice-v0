const admin = require("firebase-admin");
const serviceAccount = require("./firebaseServiceAccountKey.json"); // Ensure the correct path

// ✅ Initialize Firebase Admin SDK
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
