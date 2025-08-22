const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("./firebase"); // Use the updated Firebase config
const userRoutes = require("./routes/userRoutes");


const helmet = require("helmet");

// ✅ Load environment variables
dotenv.config();


const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
// Health check endpoint for deployment
app.get('/health', (req, res) => res.send('OK'));

// ✅ Ensure Firebase is initialized before using routes
console.log("Firebase Initialized Successfully.");

app.use("/api/user", userRoutes);
// Backward-compatible alias to avoid 404s if clients call /api/users/*
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`User Service running on port ${PORT}`));
