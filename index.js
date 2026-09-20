const express = require('express');
const cors = require("cors");
const bcrypt = require("bcrypt");
const pool = require("./db");
const { Resend } = require("resend");


const resend = new Resend(process.env.RESEND_API_KEY);
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("EventHub Backend is running!");
});

app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                error: "Name, email and password are required"
            });
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: "Email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, created_at`,
            [name, email, hashedPassword]
        );

        res.status(201).json({
            message: "Account created successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Error creating user:", error);

        res.status(500).json({
            error: "Failed to create account"
        });
    }
});

app.get("/api/events", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM events");
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

app.get("/api/events/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "SELECT * FROM events WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching event:", error);
        res.status(500).json({ error: "Failed to fetch event" });
    }
});

app.post("/api/events", async (req, res) => {
    try {
        const {
            title,
            category,
            date,
            location,
            price,
            image,
            description
        } = req.body;

        const result = await pool.query(
            `INSERT INTO events
            (title, category, date, location, price, image, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [title, category, date, location, price, image, description]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).json({ error: "Failed to create event" });
    }
});


app.post("/api/registrations", async (req, res) => {
    try {
        const { event_id, name, email, quantity, total } = req.body;

        // Generate a unique ticket number
       const ticketNumber = `EVH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

       const eventResult = await pool.query(
    "SELECT title, date, location FROM events WHERE id = $1",
    [event_id]
);

if (eventResult.rows.length === 0) {
    return res.status(404).json({
        error: "Event not found"
    });
}

const event = eventResult.rows[0];

        const result = await pool.query(
            `INSERT INTO registrations
            (event_id, name, email, quantity, total, ticket_number)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [event_id, name, email, quantity, total, ticketNumber]
        );
        
        const { data, error } = await resend.emails.send({
    from: "EventHub <onboarding@resend.dev>",
    to: [email],
    subject: `Your EventHub ticket - ${event.title}`,

html: `
    <div style="margin:0; padding:0; background-color:#f8f1e8; font-family:Arial, Helvetica, sans-serif; color:#333333;">

        <div style="max-width:600px; margin:0 auto; padding:30px 15px;">

            <!-- Header -->
            <div style="background-color:#7F1D3A; padding:25px; text-align:center; border-radius:12px 12px 0 0;">
                <h1 style="margin:0; color:#FFF8E7; font-size:30px;">
                    EventHub
                </h1>

                <p style="margin:8px 0 0; color:#FCEFE6; font-size:14px;">
                    Discover. Register. Experience.
                </p>
            </div>

            <!-- Main Content -->
            <div style="background-color:#ffffff; padding:35px 30px; border-radius:0 0 12px 12px;">

                <div style="text-align:center;">

                    <div style="display:inline-block; background-color:#FCEFE6; padding:10px 18px; border-radius:30px;">
                        <span style="color:#7F1D3A; font-weight:bold;">
                            ✓ REGISTRATION CONFIRMED
                        </span>
                    </div>

                    <h2 style="color:#5C1329; margin:25px 0 10px;">
                        You're all set, ${name}!
                    </h2>

                    <p style="color:#666666; font-size:15px; line-height:1.6;">
                        Your registration has been successfully confirmed.
                        We look forward to seeing you at the event!
                    </p>

                </div>

                <!-- Event Details -->
                <div style="margin-top:30px; border:1px solid #eadbd0; border-radius:10px; overflow:hidden;">

                    <div style="background-color:#7F1D3A; padding:15px 20px;">
                        <h3 style="margin:0; color:#ffffff; font-size:18px;">
                            Event Details
                        </h3>
                    </div>

                    <div style="padding:20px;">

                        <p style="margin:0 0 15px;">
                            <strong style="color:#5C1329;">Event</strong><br>
                            ${event.title}
                        </p>

                        <p style="margin:0 0 15px;">
                            <strong style="color:#5C1329;">Date</strong><br>
                            ${event.date}
                        </p>

                        <p style="margin:0 0 15px;">
                            <strong style="color:#5C1329;">Location</strong><br>
                            ${event.location}
                        </p>

                        <p style="margin:0;">
                            <strong style="color:#5C1329;">Number of Tickets</strong><br>
                            ${quantity}
                        </p>

                    </div>
                </div>

                <!-- Ticket Number -->
                <div style="margin-top:25px; padding:22px; background-color:#FFF8E7; border-radius:10px; text-align:center;">

                    <p style="margin:0; color:#777777; font-size:13px; text-transform:uppercase; letter-spacing:1px;">
                        Your Ticket Number
                    </p>

                    <p style="margin:10px 0 0; color:#7F1D3A; font-size:26px; font-weight:bold; letter-spacing:2px;">
                        ${ticketNumber}
                    </p>

                </div>

                <!-- Payment -->
                <div style="margin-top:20px; padding:18px 20px; border-top:1px solid #eadbd0; border-bottom:1px solid #eadbd0;">

                    <p style="margin:0; color:#666666;">
                        Amount Paid
                    </p>

                    <p style="margin:6px 0 0; color:#7F1D3A; font-size:20px; font-weight:bold;">
                        GH₵${Number(total).toFixed(2)}
                    </p>

                </div>

                <!-- Reminder -->
                <div style="margin-top:25px; padding:15px; background-color:#FCEFE6; border-radius:8px;">

                    <p style="margin:0; color:#5C1329; font-size:14px; line-height:1.5;">
                        <strong>Keep your ticket number safe.</strong><br>
                        You may need it when checking in at the event.
                    </p>

                </div>

                <!-- Footer -->
                <div style="margin-top:30px; text-align:center;">

                    <p style="margin:0; color:#7F1D3A; font-weight:bold;">
                        Thank you for choosing EventHub!
                    </p>

                    <p style="margin:8px 0 0; color:#888888; font-size:12px;">
                        This is an automated confirmation email. Please do not reply.
                    </p>

                    <p style="margin:15px 0 0; color:#aaaaaa; font-size:11px;">
                        © 2026 EventHub. All rights reserved.
                    </p>

                </div>

            </div>

        </div>

    </div>
`
        });

        if (error) {
    console.error("Error sending confirmation email:", error);
}
res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error("Error creating registration:", error);
        res.status(500).json({ error: "Failed to create registration" });
    }
});

app.get("/api/registrations", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                registrations.id,
                registrations.event_id,
                registrations.name,
                registrations.email,
                registrations.quantity,
                registrations.total,
                registrations.ticket_number,
                registrations.created_at,
                events.title AS event_title,
                events.date,
                events.location
            FROM registrations
            JOIN events
                ON registrations.event_id = events.id
            ORDER BY registrations.created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching registrations:", error);
        res.status(500).json({ error: "Failed to fetch registrations" });
    }
});

const PORT = process.env.PORT || 5000;

pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Database connected successfully!");
    }
});


app.listen(PORT, () => {
    console.log(`EventHub Backend is running at http://localhost:${PORT}`);
});

