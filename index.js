const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const fs = require('fs');
const cors = require('cors');

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
app.use(cors());
const SHOPIFY_SECRET = process.env.SHOPIFY_SECRET;
app.use(express.JSON())
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

app.post("/verify-access-code", (req, res) => {
    const { accessCode } = req.query;
    console.log("Received query")

    if (!accessCode) {
        console.log("Error in  query")
        return res.status(400).json({ status: "error", message: "Access code is required" });
    }

    const filePath = "./orders.json";
    
    fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
            return res.status(500).json({ status: "error", message: "Server error reading database" });
        }

        try {
            console.log("Replied to query")
            const orders = JSON.parse(data);
            const order = orders.find(order => order.accessCode === accessCode);

            if (order) {
                console.log("Sent back nice to  query")
                return res.status(200).json({
                    status: "success",
                    message: "Access code found",
                    name: order.name,
                    phoneNo: order.phoneNo,
                    email: order.email,
                    tickets: order.tickets
                });
            } else {
                console.log("Error in sending back to query")
                return res.status(404).json({ status: "error", message: "Invalid access code" });
            }
        } catch (parseError) {
            return res.status(500).json({ status: "error", message: "Error parsing orders database" });
        }
    });
});

app.post("/add-entry", (req, res) => {
    const reqbody = req.body;
    console.log(reqbody);
    console.log("Received query")

    if (!reqbody.accessCode) {
        console.log("Error in  query")
        return res.status(400).json({ status: "error", message: "Invalid Body" });
    }

    const filePath = "./orders.json";
    
    fs.readFile(filePath, "utf8", (err, data) => {
        let orders = []
        console.log(data)
        if (err) {
            return res.status(500).json({ status: "error", message: "Server error reading database" });
        } else {
            try {
                console.log("Replied to query")
                orders = JSON.parse(data);
                console.log(orders)
                const newOrder = JSON.parse(reqbody);
                console.log(newOrder);
                orders.forEach((order) => {
                    if(newOrder.accessCode === order.accessCode) {
                        order.tickets[0].quantity -= newOrder.generalFemaleEntry;
                        order.tickets[1].quantity -= newOrder.generalMaleEntry;
                    }
                })
                fs.writeFile(filePath, JSON.stringify(orders, null, 2), (writeErr) => {
                    if (writeErr) {
                        console.error('Error writing to file:', writeErr);
                    } else {
                        console.log('Order details saved successfully.');
                    }
                });
                return res.status(200).json({
                    status: "success",
                    message: "Entries Added",
                });
            } catch (parseError) {
                return res.status(500).json({ status: "error", message: "Error parsing orders database" });
            }
        }
    });
});


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
            let accessCode = generateAccessCode();
            filePath = './orders.json';
            fs.readFile(filePath, 'utf8', (err, data) => {
                let orders = [];
                if (!err) {
                    try {
                        orders = JSON.parse(data);
                    } catch (parseError) {
                        console.error('Error parsing JSON, initializing new file:', parseError);
                    }
                }
                orders.forEach((order) => {
                    if(order.accessCode === accessCode) {
                        accessCode = generateAccessCode();
                    }
                })
            });

            const tickets = payload.line_items.map(item => ({
                name: item.name,
                quantity: item.quantity,
            }));

            const ticketDetailsHTML = tickets.map(ticket => {
                return `<div style="margin-bottom: 10px; font-size: 16px;">${ticket.quantity} × ${ticket.name}</div>`;
            }).join('');

            const htmlTemplate = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Bigshot's Party Ticket</title>
                <style>
                    body {
                        font-family: 'Montserrat', sans-serif;
                        margin: 0;
                        padding: 0;
                        background: #fad0c4;
                        color: #700000;
                        text-align: center;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 20px auto;
                        padding: 20px;
                        border-radius: 15px;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                        background: linear-gradient(135deg, #ff9a9e, #fad0c4);
                    }
                    h1 {
                        color: #990000;
                    }
                    .access-code {
                        font-size: 24px;
                        font-weight: bold;
                        color: #cc0000;
                        background: #fff;
                        display: inline-block;
                        padding: 10px 20px;
                        border-radius: 10px;
                    }
                    .tickets-container {
                        background: #ffe6e6;
                        padding: 10px;
                        border-radius: 10px;
                        display: inline-block;
                        text-align: left;
                        margin-top: 10px;
                    }
                    .ticket {
                        font-size: 16px;
                        margin: 5px 0;
                    }
                    p {
                        font-size: 18px;
                    }
                    
                    /* Dark Mode Support */
                    @media (prefers-color-scheme: dark) {
                        body {
                            background: #1a1a1a;
                            color: #ff9a9e;
                        }
                        .email-container {
                            background: #2a2a2a;
                            box-shadow: 0 4px 8px rgba(255, 255, 255, 0.2);
                        }
                        h1 {
                            color: #ff5757;
                        }
                        .access-code {
                            color: #fff;
                            background: #ff5757;
                        }
                        .tickets-container {
                            background: #3a3a3a;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <h1>Welcome to Bigshot's Party, ${name}!</h1>
                    <p>We are thrilled to have you join us for an unforgettable night at Bigshot.</p>
                    <p><strong>Your Access Code:</strong></p>
                    <div class="access-code">${accessCode}</div>
                    <div class="tickets-container">
                        <h2>Your Tickets:</h2>
                        ${ticketDetailsHTML}
                    </div>
                    <p>Show this code at the entry to gain access.</p>
                    <p>Thank you for your purchase. We can't wait to celebrate with you!</p>
                </div>
            </body>
            </html>
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
