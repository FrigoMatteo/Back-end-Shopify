const node=require ('@shopify/shopify-api/adapters/node');
const { shopifyApi,LATEST_API_VERSION}=require( '@shopify/shopify-api');
const express=require( "express");
const {check,validationResult}=require('express-validator');
const dotenv= require( "dotenv");
const morgan = require('morgan');
const passport = require('passport');
const {initAuthentication,isLoggedIn} = require('./src/user-authentication');
const {get_orders,get_ordersId,get_products} = require('./src/shopify.js');
dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan('dev'));
const cors = require('cors');


const corsOptions={
    origin:'*',
    credentials:true,
}
app.use(cors(corsOptions))

// --------------------Init Shopify------------------------------------------------------------------------------------
const port = 4321;
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
    console.log(`Server listening at http://localhost:${port}`);
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
                
                if (err) return resp.status(500).json(err);

                return resp.json({username:user.username})
            });
        }
            
    })(req,resp,next);

});


// Retrieve own pre-orders
app.get('/api/orders',isLoggedIn ,(req,resp)=>{

    const data= get_orders(client,req.user);

    data.then((x)=>{
      console.log(x)

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
      console.log(x)

      resp.json(x);
    }).catch((x)=>{
      console.log("Error retrieving")
      resp.status(500).json(x);
    })

});


// Retrieve specific id pre-orders
app.get('/api/order/:id',isLoggedIn ,(req,resp)=>{

  const orderId = req.params.id;

  const data= get_ordersId(client,req.user,orderId);

  data.then((x)=>{
    console.log(x)

    resp.json(x);
  }).catch((x)=>{
    console.log("Error retrieving")
    resp.status(500).json(x);
  })

});


// Logout
app.delete('/api/session/logout', (req,resp)=>{
    req.logout( ()=> { resp.status(200);resp.end(); } );
});