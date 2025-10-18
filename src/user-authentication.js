const crypto = require("crypto");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { checkLoginAttempt, registerFailedAttempt, resetAttempts } = require("./loginRateLimiter.js");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();

const uri = `mongodb+srv://${process.env.USER_CALLER}:${process.env.PASS_CALLER}@cluster0.now2bqv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const db = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});
let dbInstance;

const JWT_SECRET = process.env.SECRET_SESSION;
const JWT_EXPIRATION = "10h";

// === CONNESSIONE DB === //
const connectDB = async () => {
  if (!dbInstance) {
    await db.connect();
    dbInstance = db.db(process.env.DBNAME);
  }
  return dbInstance;
};

// === LOGIN E GENERAZIONE TOKEN === //
const loginUser = async (username, password) => {
  const database = await connectDB();
  const collection = database.collection("users");
  const user = await collection.findOne({ username });

  if (!user) throw { error: "Username e password errati" };

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, user.salt, 32, async (err, hashedPassword) => {
      if (err) reject(err);

      const passwordHex = Buffer.from(user.password, "hex");

      if (!crypto.timingSafeEqual(passwordHex, hashedPassword)) {
        await registerFailedAttempt(database, user.username);
        reject({ error: "Username e password errati" });
      } else {
        await resetAttempts(database, user.username);
        const token = jwt.sign(
          { username: user.username, role: user.role || "user" },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRATION }
        );
        resolve({ token, username: user.username });
      }
    });
  });
};

// === MIDDLEWARE DI VERIFICA JWT === //
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Token mancante" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token non valido" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token scaduto o non valido" });
    req.user = user;
    next();
  });
};

// === MIDDLEWARE DI CONTROLLO RUOLO === //
const isNicola = (req, res, next) => {
  if (req.user && (req.user.username === "Nicola" || req.user.username === "MatteoFrigo")) {
    return next();
  }
  return res.status(401).json({ error: "Non autorizzato" });
};

// === RATE LIMITER === //
const checkLogin = async (req, res, next) => {
  try {
    const db = await connectDB();
    const username = req.body.username;
    const status = await checkLoginAttempt(db, username);
    if (!status.allowed) {
      return res.status(429).json({
        error: `Troppi tentativi, riprova tra ${Math.ceil(status.remaining / 1000)}s`,
      });
    } else {
      return next();
    }
  } catch (err) {
    console.error("CheckLogin:", err);
  }
};

module.exports = { loginUser, verifyToken, isNicola, checkLogin };
