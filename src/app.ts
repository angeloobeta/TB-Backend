import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import passport from "./config/passport";
import loanRoutes from "./routes/loanRoutes";
import auditRoutes from "./routes/auditRoutes";
import creditScoreRoutes from "./routes/creditScoreRoutes";
import authRoutes from "./routes/authRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import blockchainService from "./services/blockchainService";
import notificationRoutes from "./routes/notificationRoutes";
import { isAuthenticated, isLender } from "./middleware/auth";
import db from "./config/db";
import { scheduleTokenCleanup } from './services/tokenCleanup';

dotenv.config();
const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Database Connection Check
db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err: any) => console.error("❌ Database connection error:", err));

// Health check route
app.get("/health", async (req, res) => {
  const isConnected = await blockchainService.testConnection();
  res.json({
    status: "ok",
    blockchain: isConnected ? "connected" : "disconnected",
  });
});

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/loans", isAuthenticated, loanRoutes);
app.use("/api/credit-score", isAuthenticated, creditScoreRoutes);
app.use("/api/audit", isAuthenticated, isLender, auditRoutes);
app.use("/api/analytics", isAuthenticated, analyticsRoutes);
app.use("/api/notifications", isAuthenticated, notificationRoutes);

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
  }
);

scheduleTokenCleanup(60);

export default app;
