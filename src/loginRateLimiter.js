const dotenv= require( "dotenv");
dotenv.config();


const DEFAULT_RESET_WINDOW_MS = 60 * 60 * 1000; // 1 ora: se l'ultimo tentativo è > di questo, si resetta il contatore
const DELAYS_MS = [15000, 30000, 60000]; // 15s, 30s, 60s


const checkLoginAttempt=async(db, identifier)=>{
  const collection = db.collection("loginChecker");
  const doc = await collection.findOne({ identifier });

  if (!doc) return { allowed: true, remaining: 0, attempts: 0 };

  if (doc.lockUntil && doc.lockUntil instanceof Date) {
    const remaining = doc.lockUntil - Date.now();
    if (remaining > 0) {
      return { allowed: false, remaining, attempts: doc.attempts || 0 };
    }
  }

  return { allowed: true, remaining: 0, attempts: doc.attempts || 0 };
}

const registerFailedAttempt=async(db, identifier)=>{
  // opts.resetWindowMs override opzionale
  const resetWindow = DEFAULT_RESET_WINDOW_MS;
  const collection = db.collection("loginChecker");

  const now = Date.now();
  const existing = await collection.findOne({ identifier });

  let attempts;

  if (!existing) {
    // primo fallimento: crea documento
    await collection.insertOne({
      identifier,
      attempts: 1,
      lastAttempt: new Date(now)
    });
    attempts = 1;
  } else {
    const last = existing.lastAttempt ? existing.lastAttempt.getTime() : 0;

    if (now - last > resetWindow) {
      // se l'ultimo tentativo è troppo vecchio, resettiamo il contatore a 1
      await collection.updateOne(
        { identifier },
        {
          $set: { attempts: 1, lastAttempt: new Date(now) },
          $unset: { lockUntil: "" }
        }
      );
      attempts = 1;
    } else {
      // altrimenti incrementiamo il contatore
      const updated = await collection.findOneAndUpdate(
        { identifier },
        { $inc: { attempts: 1 }, $set: { lastAttempt: new Date(now) } },
        { returnDocument: "after", upsert: true }
      );
      attempts = updated?.attempts || 1;
    }
  }

  // Se attempts > 3 applichiamo la strategia di ritardo:
  if (attempts > 3) {
    const index = attempts - 4; // attempts=4 -> index=0 => DELAYS_MS[0] = 15000
    const delay = DELAYS_MS[Math.min(index, DELAYS_MS.length - 1)];
    const lockUntil = new Date(Date.now() + delay);

    await collection.updateOne(
      { identifier },
      { $set: { lockUntil } }
    );

    return { attempts, delay };
  } else {
    // assicurati che non ci sia lockUntil se siamo sotto la soglia
    await collection.updateOne(
      { identifier },
      { $unset: { lockUntil: "" } }
    );
    return { attempts, delay: 0 };
  }
}

const resetAttempts=async(db, identifier)=>{
  const collection = db.collection("loginChecker");
  await collection.deleteOne({ identifier });
}

module.exports = { checkLoginAttempt,registerFailedAttempt, resetAttempts};