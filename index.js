const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.USERMAIL,
        pass: process.env.PASS,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP connection error:', error);
    } else {
        console.log('SMTP server is ready to take messages:', success);
    }
});

const app = express();
const SHOPIFY_SECRET = process.env.SHOPIFY_SECRET;

app.use('/webhook', express.raw({ type: 'application/json', verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
}}));
app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use('/webhook', limiter);

async function sendEmail(from, to, subject, html) {
    const mailOptions = {
        from: from,
        to: to,
        subject: subject,
        html: html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

function saveOrderDetails(namevar, phoneNovar, emailvar, accessCodevar, ticketvar) {
    const filePath = './orders.json';
    let newOrder = {
        name: namevar,
        phoneNo: phoneNovar,
        email: emailvar,
        accessCode: accessCodevar,
        purchaseTime: new Date().toISOString(),
        tickets: ticketvar,
    };
    fs.readFile(filePath, 'utf8', (err, data) => {
        let orders = [];
        if (!err) {
            try {
                orders = JSON.parse(data);
            } catch (parseError) {
                console.error('Error parsing JSON, initializing new file:', parseError);
            }
        }
        orders.push(newOrder);
        fs.writeFile(filePath, JSON.stringify(orders, null, 2), (writeErr) => {
            if (writeErr) {
                console.error('Error writing to file:', writeErr);
            } else {
                console.log('Order details saved successfully.');
            }
        });
    });
}

app.post('/webhook', (req, res) => {
    console.log("Received webhook request");
    const shopifyHmac = req.headers['x-shopify-hmac-sha256'];
    const rawBody = req.rawBody;
    const generatedHmac = crypto
      .createHmac('sha256', SHOPIFY_SECRET)
      .update(rawBody)
      .digest('base64');

    if (generatedHmac === shopifyHmac) {
        console.log('HMAC Verified!');
        const payload = JSON.parse(rawBody);

        if (payload.financial_status === 'paid') {
            const email = payload.email;
            const name = payload.customer?.first_name || 'Guest';
            const phoneNum = payload.customer?.phone || "Phone Number not Provided";
            const accessCode = generateAccessCode();

            const tickets = payload.line_items.map(item => ({
                name: item.name,
                quantity: item.quantity,
            }));

            const ticketDetailsHTML = tickets.map(ticket => {
                return `<div style="margin-bottom: 10px; font-size: 16px;">${ticket.quantity} × ${ticket.name}</div>`;
            }).join('');

            const htmlTemplate = `
                <div style="font-family: 'Montserrat', sans-serif; background: linear-gradient(135deg, #ff9a9e, #fad0c4); color: #700000; padding: 20px; border-radius: 15px; text-align: center; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);">
                    <h1 style="color: #990000;">Welcome to Bigshot's Party, ${name}!</h1>
                    <p style="font-size: 18px;">We are thrilled to have you join us for an unforgettable night at Bigshot.</p>
                    <div style="margin: 20px 0; font-size: 18px;">
                        <strong>Your Access Code:</strong>
                        <div style="font-size: 24px; font-weight: bold; color: #cc0000;">${accessCode}</div>
                    </div>
                    <div style="margin: 20px auto; text-align: center; background: #ffe6e6; padding: 10px; border-radius: 10px; width: fit-content;">
                        <h2 style="font-size: 18px; color: #700000;">Your Tickets:</h2>
                        ${ticketDetailsHTML}
                    </div>
                    <p style="font-size: 18px;">Show this code at the entry to gain access.</p>
                    <p style="font-size: 16px; margin-top: 20px;">Thank you for your purchase. We can't wait to celebrate with you!</p>
                </div>
            `;

            sendEmail(
                '"Ticketing" <vades2233@gmail.com>',
                email,
                "Your Access Code for Bigshot's Party!",
                htmlTemplate
            );

            saveOrderDetails(name, phoneNum, email, accessCode, tickets)

        }

        res.status(200).send({ status: 'success', message: 'Webhook processed successfully' });
    } else {
        console.error('HMAC verification failed');
        res.status(401).send({ status: 'unauthorized', message: 'Invalid HMAC' });
    }
});

function generateAccessCode() {
    const chars = 'ABCDEFGHIJKLMNSPQRSTUVWXYZ123456789';
    return Array.from({ length: 5 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
