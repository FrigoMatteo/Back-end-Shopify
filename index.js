const node=require ('@shopify/shopify-api/adapters/node');
const { shopifyApi,LATEST_API_VERSION}=require( '@shopify/shopify-api');
const express=require( "express");
const {check,validationResult}=require('express-validator');
const dotenv= require( "dotenv");
const morgan = require('morgan');
const passport = require('passport');


const {initAuthentication,isLoggedIn} = require('./src/user-authentication');
const {get_orders,get_products,get_clients,create_clients, create_order} = require('./src/shopify.js');
dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan('dev'));
const cors = require('cors');
app.use(express.urlencoded({ extended: true }));


const allowedOrigins = [
  "https://hustleproductioncallmanagement.vercel.app", // produzione
  "http://localhost:10001",
  "https://hustleproductioncallmanagement.onrender.com",
  "http://localhost:5173"
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
  apiVersion: LATEST_API_VERSION,
});

const session = {
  shop: process.env.SHOPIFY_SHOP,
  accessToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
};


// activate the server
app.listen(port, (err) => {
  if (err)
    console.log(err);
  else 
    console.log(`Server listening at ${port}`);
}); 

// Initialize session
initAuthentication(app)
// Initialize client Shopify
const client = new shopify.clients.Graphql({session});



// --------------------Back-end Requests------------------------------------------------------------------------------------

// Login
app.post('/api/session/login', 
  [
    check("username").notEmpty().isString().withMessage("Missing username"),
    check("password").notEmpty().isString().withMessage("Missing password")
  ]
  ,function (req,resp,next){

    passport.authenticate('local',(err,user,info)=>{
        if (err){
            console.log("info:",info);
            console.log("error:",err);
            return next(err);
        }
        else{
            if (!user){
                return resp.status(401).json(info)
            }
            req.login(user, (err) =>{
                
                req.session.save((err) => {
                  if (err) {
                    console.error("Errore salvataggio sessione:", err);
                    return resp.status(500).json({ error: "Session save failed" });
                  }

                  console.log("Sessione salvata correttamente, cookie dovrebbe essere inviato");
                  return resp.json({ username: user.username });
                });
            });
        }
            
    })(req,resp,next);

});

// Did it already login
app.get('/api/session/current', (req, res) => {  
  if(req.isAuthenticated()) {
    res.status(200).json({username:req.user});
  }else
    res.status(401).json({error: 'Unauthenticated user!'});;
});

// Retrieve own pre-orders
app.get('/api/orders',isLoggedIn ,(req,resp)=>{

    const data= get_orders(client,req.user);

    data.then((x)=>{

      resp.json(x);
    }).catch((x)=>{
      console.log("Error retrieving")
      resp.status(500).json(x);
    })

});

// Create a client
app.post('/api/create/client',isLoggedIn ,(req,resp)=>{

    const { customer } = req.body;
    const data= create_clients(client,customer,req.user);

    data.then((x)=>{

      resp.json(x);
    }).catch((x)=>{
      console.log("Error creating")
      resp.status(500).json(x);
    })

});

// Create a draftOrder
app.post('/api/create/draftOrder',isLoggedIn ,(req,resp)=>{

    const { draftOrder } = req.body;
    console.log("Entered before create_order")
    const data= create_order(client,draftOrder,req.user);

    data.then((x)=>{

      resp.json(x);
    }).catch((x)=>{
      console.log("Error creating")
      resp.status(500).json(x);
    })

});


// Retrieve clients
app.get('/api/clients',isLoggedIn ,(req,resp)=>{

    const data= get_clients(client);

    data.then((x)=>{

      resp.json(x);
    }).catch((x)=>{
      console.log("Error retrieving")
      resp.status(500).json(x);
    })

});


// Retrieve own pre-orders
app.get('/api/products',isLoggedIn ,(req,resp)=>{

    const data= get_products(client);

    data.then((x)=>{

      resp.json(x);
    }).catch((x)=>{
      console.log("Error retrieving")
      resp.status(500).json(x);
    })

});

app.get('/' ,(req,resp)=>{

  resp.json('Dont tell anyone');

});

//logout
app.delete('/api/session/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(err => {
      if (err) return next(err);
      res.clearCookie("connect.sid"); // cancella il cookie lato client
      return res.sendStatus(200);
    });
  });
});