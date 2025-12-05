const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'supersecret';

function verifySignature(payload, signature){
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(JSON.stringify(payload));
    const expected = hmac.digest('hex');
    return expected === signature;
}

app.post(['/verify', '/webhook/verify'], (req, res) => {
    const { challenge } = req.body;
    console.log('Received challenge:', challenge);
    res.json({ challenge });
});

app.post(['/webhook', '/'], (req, res) => {
    const signature = req.headers['x-webhook-signature'];
    const payload = req.body;
    const ok = verifySignature(payload, signature);
    console.log('Received webhook:', payload, 'signature valid?', ok);
    res.json({ received: true, validSignature: ok });
});

app.listen(PORT, ()=> console.log(`Receiver running on http://localhost:${PORT}`));
