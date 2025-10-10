const crypto = require("crypto");
const dotenv= require( "dotenv");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const LocalStrategy = require("passport-local").Strategy;
const { checkLoginAttempt, registerFailedAttempt, resetAttempts }=require("./loginRateLimiter.js")
dotenv.config();

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER_CALLER}:${process.env.PASS_CALLER}@cluster0.now2bqv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const db = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
let dbInstance;


const initAuthentication=(app) =>{

  passport.use(new LocalStrategy(
    function(username, password, done) {
      getUser(username, password).then((user) => {   
        return done(null, user);
      }).catch((x)=>{
          console.log("Error passport password access:",x)
          return done(null, false, x);
      })
    }
  ));

  passport.serializeUser((user, done) => {
      console.log("Entered:",user.username)
      done(null, user.username); // Salva solo l’ID nella sessione
  });
  
  // Utilizzato durante l'associazione sessione_id-> id_utente.
  // id_utente sarebbe il user.username che abbiamo salvato nel serialize
  // Il deserialize salverà nel req.user il valore = username
  passport.deserializeUser((username, done) => {
    if (username!=undefined){
        done(null,username)
    }else{
        done("Undefined user",null)
    }
  });

  const mongoUrl= `mongodb+srv://${process.env.SESSION_USER}:${process.env.PASS_SESSION}@cluster0.now2bqv.mongodb.net/${process.env.DBNAME}?retryWrites=true&w=majority&appName=Cluster0`;



  app.use(session({
    proxy : true,
    secret: process.env.SECRET_SESSION,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUrl, // es: mongodb+srv://user:pass@cluster/dbname
      dbName: process.env.DBNAME,            // il tuo database
      collectionName: "sessions",
      ttl: 60 * 60 * 10,  // TTL = 10 ore (in secondi)
      autoRemove: 'native' // fa pulizia delle sessioni scadute
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite:process.env.NODE_ENV === "production" ? "none" : "lax",
      //domain: process.env.NODE_ENV === "production" ? "backendshopifyhustleproduction.onrender.com" : "",
      maxAge: 1000 * 60 * 60 * 10 // 10 ore (in ms)
    }
  }));

  // Init passport
  app.use(passport.initialize());
  app.use(passport.session());
}


const getUser=async (username, password)=>{
  
    try{
        const database = await connectDB();
        
        const collection=database.collection("users");
        const get=await collection.findOne({
            username:username
        })

        if (get==null){
          return new Promise((resolve,reject)=>{
            reject({error:"Username and password incorrect"});
          })
        }

        const salt=get.salt
        return new Promise((resolve,reject)=>{
          crypto.scrypt(password, salt, 32, async (err, hashedPassword) => {
              if (err) reject(err);

              // We create an array buffer, taking input hex of password
              const passwordHex = Buffer.from(get.password,'hex');
              
              if(!crypto.timingSafeEqual(passwordHex, hashedPassword)){
                  await registerFailedAttempt(database, get.username);
                  reject({error:"Username and password incorrect"});
              }else{
                await resetAttempts(database, get.username);
                resolve(get);
              }  
          });
        });


    }catch(error){
        console.error(error);
    }

}


const isLoggedIn = (req, res, next) => {

  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Sessione scaduta. Aggiorna la pagina' });
}

const connectDB= async ()=>{
  if (!dbInstance) {
    await db.connect();
    dbInstance = db.db(process.env.DBNAME);
  }
  return dbInstance;
}

const checkLogin = async (req, res, next) => {

  try{
    const db = await connectDB();
    const username=req.body.username
    const status = await checkLoginAttempt(db, username);
    if (!status.allowed) {
      return res.status(429).json({
        error: `Troppi tentativi, riprova tra ${Math.ceil(status.remaining / 1000)}s`
      });
    }else{
      return next();
    }
  }catch(err){
    console.error("CheckLogin:",err);
  }
}

const isNicola = (req, res, next) => {

  if (req.isAuthenticated()) {
    console.log(req.user)
    if (req.user=="Nicola" || req.user=="MatteoFrigo"){
      return next();
    }
  }
  return res.status(401).json({ error: 'Non autenticato' });
}



module.exports = { isNicola, initAuthentication,isLoggedIn, checkLogin};
