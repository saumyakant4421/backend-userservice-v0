const { auth } = require("../firebase");

class User {
  static async register(email, password, name = "", username) {
    const user = await auth.createUser({ email, password, displayName: name });

    // Store additional data in Firestore
    const db = require("../firebase").db;
    await db.collection("users").doc(user.uid).set({
      email,
      name,
      username,
      createdAt: new Date(),
      // emailVerified: false (optional, sync with Firebase Auth)
    });

    return user;
  }

  static async getUserByEmail(email) {
    return await auth.getUserByEmail(email);
  }
}

module.exports = User;
