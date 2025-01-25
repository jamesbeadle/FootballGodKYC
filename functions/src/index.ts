import * as functions from "firebase-functions";
import express from "express";
import { ActorFactory } from "./actor.factory";
import { idlFactory } from "./backend";
import crypto from "crypto"; 
import { SHUFTI_SECRET_KEY } from "./environment";

const app = express();
app.use(express.json());

function verifyShuftiSignature(rawBody: Buffer, signatureFromHeader?: string, isNewKey = true): boolean {
  if (!signatureFromHeader) return false;
  
  // The raw callback data as a string
  const responseString = rawBody.toString('utf8');
  
  // If the key is "new" (after 15 March 2023 or updated), first hash the secret key
  // Then do: hash('sha256', responseString + hashed_secret_key)
  if (isNewKey) {
    const hashedSecretKey = crypto
      .createHash("sha256")
      .update(SHUFTI_SECRET_KEY)
      .digest("hex");

    const calculatedSignature = crypto
      .createHash("sha256")
      .update(responseString + hashedSecretKey)
      .digest("hex");

    return calculatedSignature === signatureFromHeader;
  
  } else {
    // Old key approach: hash('sha256', responseString + secret_key)
    const calculatedSignature = crypto
      .createHash("sha256")
      .update(responseString + SHUFTI_SECRET_KEY)
      .digest("hex");

    return calculatedSignature === signatureFromHeader;
  }
}


app.post("/forwardKYCResponse", async (req, res) => {
  try {

    const shuftiSignature = req.header("Signature");
    const isSignatureValid = verifyShuftiSignature(req.body, shuftiSignature, /* isNewKey = */ true);
    if (!isSignatureValid) {
      console.error("Shufti signature mismatch. Possible tampering.");
      return res.status(403).send("Invalid signature");
    }
    let data;
    try {
      data = JSON.parse(req.body.toString("utf8"));
    } catch (err) {
      console.error("Invalid JSON in request body:", err);
      return res.status(400).send("Invalid JSON");
    }

    const actor = ActorFactory.createActor(
      idlFactory, 
      "44kin-waaaa-aaaal-qbxra-cai"
    );
    
    if (data.event === "verification.accepted") {
      await actor.kycVerificationCallback({
        ShuftiAcceptedResponse: {
          reference: data.reference,
          event: data.event,
        }
      });
    } else {
      await actor.kycVerificationCallback({
        ShuftiRejectedResponse: {}
      });
    }

    return res.status(200).send('OK');

  } catch (err: any) {
    console.error("Error forwarding request:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export const api = functions.https.onRequest(app);

