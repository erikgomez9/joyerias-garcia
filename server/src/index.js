import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { damagesRouter } from "./routes/damages.js";
import { warrantiesRouter } from "./routes/warranties.js";
import { clientsRouter } from "./routes/clients.js";
import { ordersRouter } from "./routes/orders.js";
import { catalogWebRouter } from "./routes/catalogWeb.js";
import { productsRouter } from "./routes/products.js";
import { reportsRouter } from "./routes/reports.js";
import { salesRouter } from "./routes/sales.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST ?? "0.0.0.0";
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Falta MONGODB_URI en server/.env");
  process.exit(1);
}

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.type("html").send(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Joyerías García API</title></head><body style="font-family:system-ui;padding:2rem;max-width:36rem"><h1>API en línea</h1><p>Esta URL es solo el servidor (inventario, ventas, pedidos). La app se abre en <strong>Vercel</strong>, no aquí.</p><p>Prueba: <a href="/api/v1/health">/api/v1/health</a></p></body></html>`
  );
});

app.get("/api/v1/health", (_req, res) => {
  res.json({
    ok: true,
    mongo:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.use("/api/v1/catalog-web", catalogWebRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/sales", salesRouter);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/clients", clientsRouter);
app.use("/api/v1/damages", damagesRouter);
app.use("/api/v1/warranties", warrantiesRouter);
app.use("/api/v1/orders", ordersRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.name === "ValidationError" ? 400 : 500;
  res.status(status).json({
    error: err.message ?? "Error interno del servidor",
  });
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB conectado");

  app.listen(PORT, HOST, () => {
    console.log(`API escuchando en ${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error("No se pudo iniciar la API:", err.message);
  process.exit(1);
});
