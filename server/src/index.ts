import express from "express";
import cors from "cors";
import { initializeDatabase } from "./database";

// Routes
import authRoutes from "./routes/auth";
import membersRoutes from "./routes/members";
import followupsRoutes from "./routes/followups";
import cellgroupsRoutes from "./routes/cellgroups";
import attendanceRoutes from "./routes/attendance";
import approvalsRoutes from "./routes/approvals";
import notificationsRoutes from "./routes/notifications";
import reportsRoutes from "./routes/reports";
import passwordRoutes from "./routes/password";
import importsRoutes from "./routes/imports";
import rotaRoutes from "./routes/rota";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ---- CORS (dev vs prod) ----
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl/health checks
    if (allowedOrigins.length === 0) return callback(null, true); // dev
    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", passwordRoutes); // ✅ password routes live under /api/auth

app.use("/api/members", membersRoutes);
app.use("/api/followups", followupsRoutes);
app.use("/api/cellgroups", cellgroupsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/approvals", approvalsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/imports", importsRoutes);
app.use("/api/rota", rotaRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
  }
);

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Church CRM Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();

export default app;