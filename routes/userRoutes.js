const express = require("express");
const {
  sendOtp,
  verifyOtp,
  updateUserName,
  loginUser,
  forgotPassword,
  verifyGoogleToken,
  addToWatchlist,  
  getWatchlist,
  removeFromWatchlist,  
  clearWatchlist,
  // Add new controller methods for watched movies
  addToWatched,
  getWatched,
  removeFromWatched,
  clearWatched
} = require("../controllers/userController");

const firebaseAuth = require("../middleware/firebaseAuth");

const router = express.Router();

// ✅ Authentication Routes
router.post("/send-otp", sendOtp); // Send OTP to email
router.post("/verify-otp", verifyOtp); // Verify OTP & Register user
router.post("/update-name", firebaseAuth, updateUserName); // Update name after registration
router.post("/login", loginUser); // Login user with email/password
router.post("/forgot-password", forgotPassword); // Send password reset email
router.post("/verify-google-token", verifyGoogleToken); // Google OAuth verification

// Watchlist routes

// Watchlist routes (protected)
router.post("/watchlist/add", firebaseAuth, addToWatchlist); // Add movie to watchlist
router.get("/watchlist", firebaseAuth, getWatchlist);
router.delete("/watchlist/remove", firebaseAuth, removeFromWatchlist); 
router.delete("/watchlist/clear", firebaseAuth, clearWatchlist);

// Watched movies routes

// Watched movies routes (protected)
router.post("/watched/add", firebaseAuth, addToWatched); // Add movie to watched list
router.get("/watched", firebaseAuth, getWatched); // Get all watched movies
router.delete("/watched/remove", firebaseAuth, removeFromWatched); // Remove movie from watched list
router.delete("/watched/clear", firebaseAuth, clearWatched); // Clear entire watched list


// Example protected route
router.get("/protected-route", firebaseAuth, (req, res) => {
  res.json({ message: "You have access!", user: req.user });
});

module.exports = router;