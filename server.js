const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const multer = require("multer");
const next = require("next");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const upload = multer();
const PORT = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();
const server = express();

const MONGO_URI = process.env.NEXT_PUBLIC_MONGODB_URI;
if (!MONGO_URI) {
  throw new Error("MONGO_URI is required. Set it in .env.local or environment variables.");
}

const configSchema = new mongoose.Schema({
  key: String,
  value: mongoose.Schema.Types.Mixed,
});
const Config = mongoose.model("Config", configSchema);

const Request = mongoose.model(
  "Request",
  new mongoose.Schema({
    partyLedger: String,
    date: String,
    category: String,
    status: String,
  })
);

const SubEntry = mongoose.model(
  "SubEntry",
  new mongoose.Schema({
    parentId: String,
    date: String,
    particular: String,
    received: Number,
    paid: Number,
    remarks: String,
  })
);

let SESSION_TIMEOUT = 1;

async function ensureAuthFields() {
  let timeoutDoc = await Config.findOne({ key: "sessionTimeoutMinutes" });
  if (!timeoutDoc) {
    timeoutDoc = await Config.create({
      key: "sessionTimeoutMinutes",
      value: 1,
    });
  }
  SESSION_TIMEOUT = parseInt(timeoutDoc.value, 10) || 1;

  let passDoc = await Config.findOne({ key: "adminPassword" });
  if (!passDoc) {
    const hash = await bcrypt.hash("1234", 10);
    await Config.create({ key: "adminPassword", value: hash });
  }

  let tokenDoc = await Config.findOne({ key: "resetToken" });
  if (!tokenDoc) {
    await Config.create({ key: "resetToken", value: "MYTOKEN123" });
  }

  console.log(`Session timeout set to ${SESSION_TIMEOUT} minute(s)`);
}

function ensureAuth(req, res, nextFn) {
  if (req.session?.loggedIn) return nextFn();
  if ((req.headers.accept || "").includes("text/html")) {
    return res.redirect("/login");
  }
  return res.status(401).json({ error: "Unauthorized" });
}

async function start() {
  await mongoose.connect(MONGO_URI);
  await ensureAuthFields();
  await nextApp.prepare();

  server.use(express.json());
  server.use(express.urlencoded({ extended: true }));
  server.use(
    session({
      secret: process.env.SESSION_SECRET || "super-secret-key",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: 1000 * 60 * SESSION_TIMEOUT,
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  server.get("/login", (req, res) => {
    if (req.session?.loggedIn) return res.redirect("/");
    return nextApp.render(req, res, "/login", req.query);
  });

  server.get("/reset", (req, res) => nextApp.render(req, res, "/reset", req.query));

  server.post("/login", async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).send("Password required");

      const passDoc = await Config.findOne({ key: "adminPassword" });
      if (!passDoc) return res.status(500).send("No admin password configured");

      const isMatch = await bcrypt.compare(password, passDoc.value);
      if (!isMatch) return res.status(401).send("Wrong password");

      req.session.loggedIn = true;
      return res.status(200).send("OK");
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).send("Login error");
    }
  });

  server.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
  });

  server.post("/reset-password", upload.none(), async (req, res) => {
    const { token, newPassword } = req.body;
    try {
      if (!token || !newPassword) {
        return res.status(400).send("Token and newPassword are required");
      }

      const tokenDoc = await Config.findOne({ key: "resetToken" });
      if (!tokenDoc || tokenDoc.value !== token) {
        return res.status(400).send("Invalid or expired token");
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await Config.updateOne({ key: "adminPassword" }, { value: hash });
      return res.send("Password reset successful! Please login with new password.");
    } catch (err) {
      console.error(err);
      return res.status(500).send("Error resetting password");
    }
  });

  server.get("/", ensureAuth, (req, res) => nextApp.render(req, res, "/index", req.query));
  server.get("/index", ensureAuth, (req, res) => res.redirect("/"));
  server.get("/details", ensureAuth, (req, res) =>
    nextApp.render(req, res, "/details", req.query)
  );

  server.post("/submit", ensureAuth, async (req, res) => {
    try {
      const { partyLedger, date, category, status } = req.body;
      if (!partyLedger || !date) {
        return res.status(400).json({ error: "partyLedger and date are required" });
      }
      const doc = await new Request({ partyLedger, date, category, status }).save();
      return res.json({ success: true, data: doc });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to create ledger" });
    }
  });

  server.get("/requests", ensureAuth, async (req, res) => {
    try {
      const requests = await Request.find().sort({ _id: -1 });
      return res.json(requests);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to fetch ledgers" });
    }
  });

  server.get("/request/:id", ensureAuth, async (req, res) => {
    try {
      const request = await Request.findById(req.params.id);
      if (!request) return res.status(404).json({ error: "Not found" });
      return res.json(request);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to fetch ledger" });
    }
  });

  server.put("/request/:id", ensureAuth, async (req, res) => {
    try {
      const updated = await Request.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updated) return res.status(404).json({ error: "Not found" });
      return res.json(updated);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to update ledger" });
    }
  });

  server.delete("/request/:id", ensureAuth, async (req, res) => {
    try {
      const deleted = await Request.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Not found" });
      await SubEntry.deleteMany({ parentId: req.params.id });
      return res.json({ success: true, data: deleted });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to delete ledger" });
    }
  });

  server.post("/sub-entry", ensureAuth, async (req, res) => {
    try {
      const { parentId, date, particular, received, paid, remarks } = req.body;
      if (!parentId || !date) {
        return res.status(400).json({ error: "parentId and date are required" });
      }
      const doc = await new SubEntry({
        parentId,
        date,
        particular,
        received,
        paid,
        remarks,
      }).save();
      return res.json({ success: true, data: doc });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to create sub-entry" });
    }
  });

  server.get("/sub-entries/:parentId", ensureAuth, async (req, res) => {
    try {
      const entries = await SubEntry.find({ parentId: req.params.parentId });
      return res.json(entries);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to fetch sub-entries" });
    }
  });

  server.put("/sub-entry/:id", ensureAuth, async (req, res) => {
    try {
      const updated = await SubEntry.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!updated) return res.status(404).json({ error: "Not found" });
      return res.json(updated);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to update sub-entry" });
    }
  });

  server.delete("/sub-entry/:id", ensureAuth, async (req, res) => {
    try {
      const deleted = await SubEntry.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Not found" });
      return res.json({ success: true, data: deleted });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to delete sub-entry" });
    }
  });

  server.delete("/sub-entries/:parentId", ensureAuth, async (req, res) => {
    try {
      await SubEntry.deleteMany({ parentId: req.params.parentId });
      return res.json({ success: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to delete sub-entries" });
    }
  });

  server.get("/ledger/:id", ensureAuth, async (req, res) => {
    try {
      const ledger = await Request.findById(req.params.id);
      if (!ledger) return res.status(404).json({ error: "Ledger not found" });
      return res.json(ledger);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to fetch ledger" });
    }
  });

  server.put("/ledger/:id", ensureAuth, async (req, res) => {
    try {
      const result = await Request.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!result) return res.status(404).json({ error: "Ledger not found" });
      return res.json(result);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to update ledger" });
    }
  });

  server.use((err, req, res, nextFn) => {
    console.error("Unhandled error:", err);
    if (res.headersSent) return nextFn(err);
    return res.status(500).send("Something broke!");
  });

  server.all(/.*/, (req, res) => handle(req, res));

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});


