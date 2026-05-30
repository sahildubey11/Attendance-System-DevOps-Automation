const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");

const app = express();
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = Number(process.env.DB_PORT || 3306);
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "root";
const dbName = process.env.DB_NAME || "attendance";
const startupDelayMs = Number(process.env.DB_RETRY_DELAY_MS || 2000);

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const dbPromise = db.promise();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function initializeDatabase() {
  while (true) {
    try {
      await dbPromise.query(`
        CREATE TABLE IF NOT EXISTS records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255),
          status VARCHAR(50)
        )
      `);

      console.log("Table Ready");
      return;
    } catch (err) {
      console.error("Waiting for database to be ready:", err.message);
      await sleep(startupDelayMs);
    }
  }
}

app.get("/", (req, res) => {

  db.query("SELECT * FROM records", (err, results) => {

    if (err) {
      console.log(err);
      return res.render("index", { records: [] });
    }

    res.render("index", { records: results || [] });

  });

});

app.post("/add", (req, res) => {
  const { name, status } = req.body;

  if (!name || !status) {
    return res.status(400).send("Name and status are required.");
  }

  db.query(
    "INSERT INTO records (name, status) VALUES (?, ?)",
    [name, status],
    (err) => {
      if (err) {
        console.error("Failed to insert record:", err);
        return res.status(500).send("Failed to add record.");
      }

      res.redirect("/");
    }
  );
});

async function startServer() {
  await initializeDatabase();

  app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on port 3000");
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
