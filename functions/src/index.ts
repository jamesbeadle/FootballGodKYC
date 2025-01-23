import * as functions from "firebase-functions";
import express from "express";
import axios from "axios";
import { Cbor } from "@dfinity/agent";

const app = express();
app.use(express.json());

app.post("/forwardKYCResponse", async (req, res) => {
  try {
    const data = req.body;

    data.request_type = Cbor.encode("call");
    data.sender = Cbor.encode("aaaaa-aa");
    data.canister_id = Cbor.encode("44kin-waaaa-aaaal-qbxra-cai");
    data.method_name = Cbor.encode("kycVerificationCallback");

    const forwardUrl = "https://ic0.app/api/v2/canister/44kin-waaaa-aaaal-qbxra-cai/call";
    const response = await axios.post(forwardUrl, data);

    return res.status(response.status).send(response.data);
  } catch (err: any) {
    console.error("Error forwarding request:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export const api = functions.https.onRequest(app);
