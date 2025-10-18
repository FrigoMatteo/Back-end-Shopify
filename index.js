const node=require ('@shopify/shopify-api/adapters/node');
const { shopifyApi,ApiVersion}=require( '@shopify/shopify-api');
const express = require("express");
const { check, validationResult } = require("express-validator");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");

const {
  loginUser,
  verifyToken,
  isNicola,
  checkLogin,
} = require("./src/user-authentication");
const {
  createUser,
  visualizeUsers,
  eliminateUser,
  changePassword,
} = require("./src/commercials.js");
const {
  get_orders,
  get_products,
  get_clients,
  create_clients,
  create_order,
} = require("./src/shopify.js");

dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));


const allowedOrigins = [
  "https://hustleproductioncallmanagement.vercel.app", // produzione
];

app.use(cors({
  origin: function (origin, callback) {
    // Permetti richieste senza origin (come Postman) o che siano nella lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Origin non permesso"));
    }
  },
  credentials: true
}));

/*
app.use(cors({
  origin: "https://hustleproductioncallmanagement.onrender.com",
  credentials: true
}));
*/

//app.use(cors(corsOptions))

// --------------------Init Shopify------------------------------------------------------------------------------------
const port = 10000;
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  hostName: process.env.HOST.replace(/https?:\/\//, ""),
  apiVersion: ApiVersion.July25,
});

const session = {
  shop: process.env.SHOPIFY_SHOP,
  accessToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
};
const client = new shopify.clients.Graphql({session});


// activate the server
app.listen(port, (err) => {
  if (err)
    console.log(err);
  else 
    console.log(`Server listening at ${port}`);
}); 

// === LOGIN === //
app.post(
  "/api/session/login",
  [
    check("username").notEmpty().isString().withMessage("Missing username"),
    check("password").notEmpty().isString().withMessage("Missing password"),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    },
  ],
  checkLogin,
  async (req, res) => {
    try {
      const { username, password } = req.body;
      const data = await loginUser(username, password);
      return res.json(data); // contiene { token, username }
    } catch (err) {
      return res.status(401).json(err);
    }
  }
);

// === VERIFICA TOKEN === //
app.get("/api/session/current", verifyToken, (req, res) => {
  res.status(200).json({ username: req.user.username });
});

// === LOGOUT (simbolico) === //
app.delete("/api/session/logout", (req, res) => {
  // lato client basta cancellare il token, ma rispondiamo OK per coerenza
  return res.sendStatus(200);
});

// === ROTTE PROTETTE === //
app.post("/api/createCom/create", verifyToken, isNicola, (req, res) => {
  const { comUsername, comPassword } = req.body;
  createUser(comUsername, comPassword)
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.get("/api/createCom/list", verifyToken, isNicola, (req, res) => {
  visualizeUsers()
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.delete("/api/createCom/delete", verifyToken, isNicola, (req, res) => {
  const { comUsername } = req.body;
  eliminateUser(comUsername)
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.post("/api/createCom/change", verifyToken, isNicola, (req, res) => {
  const { comUsername, password, newPassword } = req.body;
  changePassword(comUsername, password, newPassword)
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.get("/api/orders", verifyToken, (req, res) => {
  get_orders(client, req.user.username)
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.post("/api/create/client", verifyToken, (req, res) => {
  const { customer } = req.body;
  create_clients(client, customer, req.user.username)
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.post("/api/create/draftOrder", verifyToken, (req, res) => {
  const { draftOrder } = req.body;
  create_order(client, draftOrder, req.user.username)
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.get("/api/clients", verifyToken, (req, res) => {
  get_clients(client)
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.get("/api/products", verifyToken, (req, res) => {
  get_products(client)
    .then((x) => res.json(x))
    .catch((err) => res.status(500).json(err));
});

app.get("/", (req, res) => {
  res.json("Dont tell anyone");
});