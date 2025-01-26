import * as functions from "firebase-functions";
import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { ActorFactory } from "./actor.factory";
import { idlFactory } from "./backend";
import { SHUFTI_CLIENT_ID, SHUFTI_SECRET_KEY } from "./environment";
import axios from "axios";

// 1. Extend Express Request to allow `req.rawBody`
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

// This middleware "verify" function has 4 parameters in its signature
function rawBodySaver(req: Request, res: Response, buf: Buffer, encoding: string) {
  if (buf && buf.length) {
    req.rawBody = buf; // store raw Buffer on the request
  }
}

const app = express();

// 2. Pass the `rawBodySaver` as the `verify` function
app.use(bodyParser.json({ verify: rawBodySaver }));

function verifyShuftiSignature(
  rawBody: Buffer | undefined,
  signatureFromHeader: string | undefined,
  isNewKey = true
): boolean {
  if (!signatureFromHeader || !rawBody) return false;

  const responseString = rawBody.toString("utf8");

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
    const calculatedSignature = crypto
      .createHash("sha256")
      .update(responseString + SHUFTI_SECRET_KEY)
      .digest("hex");

    return calculatedSignature === signatureFromHeader;
  }
}

app.post("/forwardKYCResponse", async (req: Request, res: Response) => {
  try {
    const shuftiSignature = req.header("Signature");
    const isSignatureValid = verifyShuftiSignature(req.rawBody, shuftiSignature, true);
    if (!isSignatureValid) {
      console.error("Shufti signature mismatch. Possible tampering.");
      return res.status(403).send("Invalid signature");
    }

    // Now safely parse the raw body
    let data;
    try {
      data = JSON.parse(req.rawBody!.toString("utf8"));
    } catch (err) {
      console.error("Invalid JSON in request body:", err);
      return res.status(400).send("Invalid JSON");
    }

    const actor = ActorFactory.createActor(idlFactory, "44kin-waaaa-aaaal-qbxra-cai");

    if (data.event === "verification.accepted") {
      await actor.kycVerificationCallback({
        ShuftiAcceptedResponse: {
          reference: data.reference,
          event: data.event,
        },
      });
    } else if (data.event === "verification.status.changed") {

      const payload = {
        reference: data.reference,
      };
      
      try {
        const token = btoa(`${SHUFTI_CLIENT_ID}:${SHUFTI_SECRET_KEY}`); 
        const status = await axios.post(
          'https://api.shuftipro.com/status',
          payload,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Basic ${token}`, 
            },
          }
        );

        if(status.data.event == "verification.accepted"){
          await actor.kycVerificationCallback({
            ShuftiAcceptedResponse: {
              reference: data.reference,
              event: status.data.event,
            },
          });
        }

        if(status.data.event == "verification.rejected"){
          await actor.kycVerificationCallback({
            ShuftiRejectedResponse: {
              reference: data.reference,
              event: status.data.event
            },
          });
        }

      } catch (error) {
        console.error('Error:', error);
        throw error;
      }

    } else if (data.event === "verification.rejected") {
      await actor.kycVerificationCallback({
        ShuftiRejectedResponse: {
          reference: data.reference,
          event: data.event
        },
      });
    }

    return res.status(200).send("OK");
  } catch (err: any) {
    console.error("Error forwarding request:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export const api = functions.https.onRequest(app);
