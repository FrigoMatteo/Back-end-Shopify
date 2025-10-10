const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
require('dotenv').config();

const uri = `mongodb+srv://${process.env.COM_USER}:${process.env.PASS_COM}@cluster0.now2bqv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });
let collection;
let collectionSession;


const initDB=async()=>{
  if (!collection) {
    await client.connect();
    const database = client.db('hustleProduction');
    collection = database.collection('users');
    await collection.createIndex({ username: 1 }, { unique: true });
  }
}

const initDBSession=async()=>{
  if (!collectionSession) {
    await client.connect();
    const database = client.db('hustleProduction');
    collectionSession = database.collection('sessions');
  }
}


const createUser=async(username, pass)=> {
  if (!username || !pass) return { success: false, message: 'Username e password richiesti' };
  await initDB();
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedBuffer = await scrypt(pass, salt, 32);
    const passwordHex = Buffer.from(hashedBuffer).toString('hex');

    const add = await collection.insertOne({ username, password: passwordHex, salt });
    return add.acknowledged
      ? { success: true, message: 'Utente creato', username }
      : { success: false, message: 'Errore durante l\'inserimento' };
  } catch (err) {
    // Mongo duplicate key error code 11000
    if (err && err.code === 11000) return { success: false, message: 'Username già esistente' };
    return { success: false, message: err.message || String(err) };
  }
}

const changePassword=async(username, oldPassword, newPassword)=> {
  const user = await collection.findOne({ username });
  if (!user) return { success: false, message: 'Utente non trovato' };

  const hashedOld = await scrypt(oldPassword, user.salt, 32);

  const storedPasswordHex = Buffer.from(user.password, 'hex');
  if (!crypto.timingSafeEqual(storedPasswordHex, hashedOld)) {
    return { success: false, message: 'Vecchia password sbagliata' };
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHashed = await scrypt(newPassword, newSalt, 32);
  const newHashedHex = Buffer.from(newHashed).toString('hex');


  const result = await collection.updateOne(
    { username },
    { $set: { password: newHashedHex, salt: newSalt } }
  );

  return result.acknowledged
    ? { success: true, message: 'Password aggiornata', username }
    : { success: false, message: 'Errore durante l’aggiornamento' };
}

const visualizeUsers=async()=>{
  await initDB();
  const users = await collection.find({}, { projection: { username: 1, _id: 0 } }).toArray();
  return users;
}

const eliminateUser=async(username)=> {
  if (!username) return { success: false, message: 'Username richiesto' };
  await initDB();

  await initDBSession()

  const deleteSessions = await collectionSession.deleteMany({
    'session': { $regex: username }
  });
  console.log("Delete:",deleteSessions)

  if (!deleteSessions.acknowledged) {
    return { success: true, message: 'Utente eliminato ma errore durante la rimozione delle sessioni attive.' };
  }

  const result = await collection.deleteOne({ username });
  return result.deletedCount === 1
    ? { success: true, message: 'Utente eliminato' }
    : { success: false, message: 'Nessun utente trovato con questo username' };
}

const close=async()=>{
  try { await client.close(); } catch (e) { /* ignore */ }
}

module.exports = { createUser, visualizeUsers, eliminateUser, close ,changePassword};