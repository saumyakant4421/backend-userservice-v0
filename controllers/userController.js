// backend/usercontroller
const { auth } = require("../firebase");
const otpGenerator = require("otp-generator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOTP } = require("../services/emailService");

const otpStore = new Map(); // Temporary OTP storage

// ✅ Generate Unique Username
const generateUsername = (email) => {
  const base = email.split("@")[0].substring(0, 6); // Get first 6 letters before @
  const randomNum = Math.floor(1000 + Math.random() * 9000); // Random 4-digit number
  return `${base}_${randomNum}`;
};

// ✅ Send OTP
exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  try {
    console.log(`📩 Sending OTP to: ${email}`);

    const otp = otpGenerator.generate(6, {
      digits: true,
      upperCase: false,
      specialChars: false,
    });
    otpStore.set(email, { otp, expiresAt: Date.now() + 300000 });

    await sendOTP(email, otp);

    console.log("✅ OTP sent successfully! Stored OTP:", otp);
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(
      "❌ Error sending OTP:",
      error.message,
      error.response || "No response details"
    );
    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      error: isDev ? error.message || error.toString() : "Failed to send OTP",
    });
  }
};

// ✅ Verify OTP & Register User (Name optional, updated later)
exports.verifyOtp = async (req, res) => {
  const { email, otp, password } = req.body;

  // Validate only required fields for initial registration
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!otp) {
    return res.status(400).json({ error: "OTP is required" });
  }
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  console.log(`📩 Verifying OTP for: ${email}, Input OTP: ${otp}`);

  const storedOtp = otpStore.get(email);
  if (!storedOtp) {
    console.error("❌ No OTP found for email:", email);
    return res
      .status(400)
      .json({ error: "No OTP record found for this email" });
  }

  if (storedOtp.otp !== otp) {
    console.error(
      "❌ OTP mismatch: Input OTP:",
      otp,
      "Stored OTP:",
      storedOtp.otp
    );
    return res.status(400).json({ error: "Invalid OTP" });
  }

  if (Date.now() > storedOtp.expiresAt) {
    console.error(
      "❌ OTP expired: Current time:",
      Date.now(),
      "Expires at:",
      storedOtp.expiresAt
    );
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP has expired" });
  }

  otpStore.delete(email);
  console.log("✅ OTP verified successfully!");

  try {
    console.log("✅ OTP Verified! Creating user...");

    // Check if email is already in use
    try {
      await auth.getUserByEmail(email);
      return res
        .status(400)
        .json({
          error:
            "Email is already registered. Please log in or use a different email.",
        });
    } catch (userNotFoundError) {
      if (userNotFoundError.code !== "auth/user-not-found") {
        throw userNotFoundError; // Re-throw other errors
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = generateUsername(email);

    // Store in Firebase Authentication
    const user = await auth.createUser({
      email,
      password,
    });

    let verificationLink = null;
    try {
      // Generate email verification link using Admin SDK
      const actionCodeSettings = {
        url: "http://localhost:3000/verify-email", // Local URL for testing
        handleCodeInApp: true,
      };
      verificationLink = await auth.generateEmailVerificationLink(
        email,
        actionCodeSettings
      );
      console.log("Verification link generated:", verificationLink);
    } catch (linkError) {
      console.warn(
        "⚠️ Failed to generate verification link:",
        linkError.message
      );
      // Proceed without sending verification link if generation fails
    }

    // Get user record to sync createdAt and emailVerified
    const userRecord = await auth.getUser(user.uid);

    // Check Firestore if user exists
    const db = require("../firebase").db;
    const userRef = db.collection("users").doc(user.uid);
    const userDoc = await userRef.get();

    try {
      if (!userDoc.exists) {
        await userRef.set({
          email,
          name: "", // Name will be updated later
          username,
          createdAt: new Date(userRecord.metadata.creationTime), // Sync with Firebase Auth
          emailVerified: userRecord.emailVerified, // Sync with Firebase Auth
        });
        console.log(
          "Firestore user data saved successfully for UID:",
          user.uid
        );
      } else {
        console.log("User document already exists for UID:", user.uid);
      }
    } catch (firestoreError) {
      console.error("❌ Error saving to Firestore:", firestoreError.message);
      throw firestoreError; // Re-throw to be caught by outer try/catch
    }

    res.status(201).json({
      uid: user.uid,
      email,
      username,
      message: verificationLink
        ? "OTP verified! Please enter your name to complete registration."
        : "OTP verified, but verification link could not be sent. Please contact support.",
      emailVerified: userRecord.emailVerified,
    });
  } catch (error) {
    console.error("❌ Error creating user:", error.message);
    res.status(400).json({ error: error.message });
  }
};

// ✅ Update Name After Account Creation
exports.updateUserName = async (req, res) => {
  const { uid, name } = req.body;

  if (!uid || !name) {
    return res.status(400).json({ error: "User ID and name are required." });
  }

  try {
    const db = require("../firebase").db;
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found." });
    }

    await userRef.update({ name: name.trim() });
    await auth.updateUser(uid, { displayName: name.trim() });

    res
      .status(200)
      .json({ message: "Name updated successfully! Redirecting to login..." });
  } catch (error) {
    console.error("❌ Error updating name:", error);
    res.status(500).json({ error: "Failed to update name." });
  }
};

// ✅ Login User with Email Verification Check
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verify Firebase User
    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord) return res.status(400).json({ error: "User not found!" });

    if (!userRecord.emailVerified) {
      return res
        .status(403)
        .json({ error: "Email not verified! Please check your inbox." });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { uid: userRecord.uid, email: userRecord.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ message: "Login successful!", token });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(400).json({ error: "Invalid credentials!" });
  }
};

// ✅ Forgot Password - Use Firebase Built-in with SendGrid SMTP
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const actionCodeSettings = {
      url: "https://yourdomain.com/reset-password", // Your frontend reset page
      handleCodeInApp: true,
    };

    await auth.sendPasswordResetEmail(email, actionCodeSettings);

    res
      .status(200)
      .json({ message: "Password reset email sent! Check your inbox." });
  } catch (error) {
    console.error("❌ Error sending password reset:", error.message);
    res.status(500).json({ error: "Failed to send reset email" });
  }
};

// ✅ Verify Google Token (Google Sign-In)
exports.verifyGoogleToken = async (req, res) => {
  const { token } = req.body;
  if (!token)
    return res.status(400).json({ error: "Google token is required." });

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const user = await auth.getUser(decodedToken.uid);

    const db = require("../firebase").db;
    const userRef = db.collection("users").doc(user.uid);
    const userDoc = await userRef.get();

    let username;

    if (!userDoc.exists) {
      username = generateUsername(user.email);
      await userRef.set({
        email: user.email,
        username,
        name: user.displayName || "", // Use displayName or empty if unavailable
        createdAt: new Date(user.metadata.creationTime), // Sync with Firebase Auth
        emailVerified: user.emailVerified, // Sync with Firebase Auth
      });
    } else {
      username = userDoc.data().username;
    }

    res.status(200).json({
      uid: user.uid,
      email: user.email,
      username,
      message: "Google authentication successful",
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid Google token." });
  }
};

// ✅ Middleware: Verify JWT Token
exports.verifyToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ message: "Access Denied!" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid Token!" });
  }
};

// Add movie to watchlist
exports.addToWatchlist = async (req, res) => {
  try {
    const { id, title, poster } = req.body;
    const uid = req.user.uid;
    if (!id || !title || !poster) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const db = require("../firebase").db;
    const watchlistRef = db.collection("watchlists").doc(uid);
    const watchlistDoc = await watchlistRef.get();
    if (!watchlistDoc.exists) {
      await watchlistRef.set({
        movies: [{ id, title, poster, addedAt: new Date() }],
      });
    } else {
      const watchlist = watchlistDoc.data();
      const movieExists = watchlist.movies.some((movie) => movie.id === id);
      if (movieExists) {
        return res.status(400).json({ error: "Movie already in watchlist" });
      }
      await watchlistRef.update({
        movies: [
          ...watchlist.movies,
          { id, title, poster, addedAt: new Date() },
        ],
      });
    }
    res.status(200).json({ message: "Movie added to watchlist" });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    res.status(500).json({ error: "Failed to add movie to watchlist" });
  }
};

// Get user's watchlist
exports.getWatchlist = async (req, res) => {
  try {
    const uid = req.user.uid;
    const db = require("../firebase").db;
    const watchlistRef = db.collection("watchlists").doc(uid);
    const watchlistDoc = await watchlistRef.get();
    if (!watchlistDoc.exists) {
      return res.status(200).json([]); // Return empty array if no watchlist
    }
    const watchlist = watchlistDoc.data();
  const sortedMovies = watchlist.movies.sort(
      (a, b) => {
        try {
          const aDate = a.addedAt?.toDate ? a.addedAt.toDate() : new Date(a.addedAt || 0);
          const bDate = b.addedAt?.toDate ? b.addedAt.toDate() : new Date(b.addedAt || 0);
          return bDate - aDate;
        } catch (e) {
          return 0;
        }
      }
    );
    res.status(200).json(sortedMovies);
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
};

// Remove movie from watchlist
exports.removeFromWatchlist = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { movieId } = req.query;
    if (!movieId) {
      return res.status(400).json({ error: "Movie ID is required" });
    }
    const db = require("../firebase").db;
    const watchlistRef = db.collection("watchlists").doc(uid);
    const watchlistDoc = await watchlistRef.get();
    if (!watchlistDoc.exists) {
      return res.status(404).json({ error: "Watchlist not found" });
    }
    const watchlist = watchlistDoc.data();
    const updatedMovies = watchlist.movies.filter(
      (movie) => movie.id !== parseInt(movieId)
    );
    await watchlistRef.update({ movies: updatedMovies });
    res.status(200).json({ message: "Movie removed from watchlist" });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    res.status(500).json({ error: "Failed to remove movie from watchlist" });
  }
};

// Clear entire watchlist
exports.clearWatchlist = async (req, res) => {
  try {
    const uid = req.user.uid;
    const db = require("../firebase").db;
    const watchlistRef = db.collection("watchlists").doc(uid);
    await watchlistRef.update({ movies: [] });
    res.status(200).json({ message: "Watchlist cleared" });
  } catch (error) {
    console.error("Error clearing watchlist:", error);
    res.status(500).json({ error: "Failed to clear watchlist" });
  }
};

// Add movie to watched list
exports.addToWatched = async (req, res) => {
  try {
    const { uid, movie } = req.body;

    if (!uid || !movie || !movie.id || !movie.title || !movie.poster) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = require("../firebase").db;
    const watchedRef = db.collection("watched").doc(uid);
    const watchedDoc = await watchedRef.get();

    if (!watchedDoc.exists) {
      // Create new watched list for user
      await watchedRef.set({
        movies: [
          {
            id: movie.id,
            title: movie.title,
            poster: movie.poster,
            watchedAt: new Date(),
          },
        ],
      });
    } else {
      // Update existing watched list
      const watched = watchedDoc.data();

      // Check if movie already exists in watched list
      const movieExists = watched.movies.some((m) => m.id === movie.id);
      if (movieExists) {
        return res.status(400).json({ error: "Movie already in watched list" });
      }

      // Add movie to watched list
      await watchedRef.update({
        movies: [
          ...watched.movies,
          {
            id: movie.id,
            title: movie.title,
            poster: movie.poster,
            watchedAt: new Date(),
          },
        ],
      });
    }

    res.status(200).json({ message: "Movie added to watched list" });
  } catch (error) {
    console.error("Error adding to watched list:", error);
    res.status(500).json({ error: "Failed to add movie to watched list" });
  }
};

// Get user's watched movies
exports.getWatched = async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const db = require("../firebase").db;
    const watchedRef = db.collection("watched").doc(uid);
    const watchedDoc = await watchedRef.get();

    if (!watchedDoc.exists) {
      return res.status(200).json([]); // Return empty array if no watched list
    }

    const watched = watchedDoc.data();
    // Sort by most recently watched
    const sortedMovies = watched.movies.sort(
      (a, b) => b.watchedAt.toDate() - a.watchedAt.toDate()
    );

    res.status(200).json(sortedMovies);
  } catch (error) {
    console.error("Error fetching watched list:", error);
    res.status(500).json({ error: "Failed to fetch watched list" });
  }
};

// Remove movie from watched list
exports.removeFromWatched = async (req, res) => {
  try {
    const { uid, movieId } = req.query;

    if (!uid || !movieId) {
      return res
        .status(400)
        .json({ error: "User ID and Movie ID are required" });
    }

    const db = require("../firebase").db;
    const watchedRef = db.collection("watched").doc(uid);
    const watchedDoc = await watchedRef.get();

    if (!watchedDoc.exists) {
      return res.status(404).json({ error: "Watched list not found" });
    }

    const watched = watchedDoc.data();
    const updatedMovies = watched.movies.filter(
      (movie) => movie.id !== parseInt(movieId)
    );

    await watchedRef.update({ movies: updatedMovies });

    res.status(200).json({ message: "Movie removed from watched list" });
  } catch (error) {
    console.error("Error removing from watched list:", error);
    res.status(500).json({ error: "Failed to remove movie from watched list" });
  }
};

// Clear entire watched list
exports.clearWatched = async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const db = require("../firebase").db;
    const watchedRef = db.collection("watched").doc(uid);

    await watchedRef.update({ movies: [] });

    res.status(200).json({ message: "Watched list cleared" });
  } catch (error) {
    console.error("Error clearing watched list:", error);
    res.status(500).json({ error: "Failed to clear watched list" });
  }
};
