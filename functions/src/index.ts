import * as functions from "firebase-functions";
import express from "express";
import { ActorFactory } from "./actor.factory";
import { idlFactory } from "./backend";
const app = express();
app.use(express.json());

app.post("/forwardKYCResponse", async (req, res) => {
  try {

    const actor = ActorFactory.createActor(
      idlFactory, 
      "44kin-waaaa-aaaal-qbxra-cai"
    );
    
    const data = req.body;
    
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

