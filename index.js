const express = require('express');
const cors = require("cors");
const bcrypt = require("bcrypt");
const pool = require("./db");

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

        const result = await pool.query(
            `INSERT INTO registrations
            (event_id, name, email, quantity, total, ticket_number)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [event_id, name, email, quantity, total, ticketNumber]
        );

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

