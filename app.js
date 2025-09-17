import express from "express";
import session from "express-session";
import cors from "cors";
import passport from "passport";
import { PORT } from "./config/env.js";
import authRouter from "./routes/auth.routes.js";
import clinicRouter from "./routes/clinics.routes.js";
import patientRouter from "./routes/patient.routes.js";
import eobRouter from "./routes/eob.routes.js";
import coverageRouter from "./routes/coverage.routes.js";
import codeRouter from "./routes/code.routes.js";
import { ClerkExpressWithAuth } from "@clerk/clerk-sdk-node";

import mongoose from "mongoose";

import "dotenv/config.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-clerk-auth-reason"],
    exposedHeaders: ["x-clerk-auth-reason"]
  })
);

app.use(
  session({
    secret: "u4kXyZsH3gT8rBv2LpE7cWnAqDjMfYxQ",
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true for production with HTTPS
      sameSite: "Lax",
      maxAge: 24 * 60 * 60 * 1000, // Use 'Lax' for production or same-origin
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(ClerkExpressWithAuth());

app.use("/api/auth", authRouter);

app.use("/api/clinics",clinicRouter);

app.use("/api/patient", patientRouter);

app.use("/api/eob", eobRouter);

app.use("/api/coverage", coverageRouter);

app.use("/api/codes",codeRouter);

app.get("/", (req, res) => {
  res.send("api running");
});

mongoose
  // eslint-disable-next-line no-undef
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.log("MongoDB connection failed", err));
