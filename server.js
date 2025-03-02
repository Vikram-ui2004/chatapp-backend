require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // React Frontend URL
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Connection Error:", err));

// User Schema & Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
  });
  const User = mongoose.model("User", userSchema);
  
  // API Route: Register User
  app.post("/register", async (req, res) => {
    try {
      const { username, password } = req.body;
  
      // Check if user already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) return res.status(400).json({ message: "Username already exists" });
  
      // Hash password before storing
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ username, password: hashedPassword });
      await newUser.save();
  
      res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server Error", error: err.message });
    }
  });
  
// ✅ Login a User
app.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;
  
      // Check if user exists
      const user = await User.findOne({ username });
      if (!user) return res.status(400).json({ message: "Invalid Credentials" });
  
      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });
  
      // Generate JWT Token
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  
      res.json({ token, username: user.username });
    } catch (err) {
      res.status(500).json({ message: "Server Error" });
    }
  });
  
// Socket.io for Real-time Chat
let usersInRooms = {}; // Store users per room

io.on("connection", (socket) => {
  console.log(`✅ User Connected: ${socket.id}`);

  socket.on("join_room", ({ username, room }) => {
    socket.join(room);

    // Store user in room
    if (!usersInRooms[room]) {
      usersInRooms[room] = [];
    }
    usersInRooms[room].push({ id: socket.id, username });

    console.log(`📢 ${username} joined room: ${room}`);

    // Send updated user list to everyone in the room
    io.to(room).emit("update_user_list", usersInRooms[room]);
  });

  socket.on("send_message", (data) => {
    io.to(data.room).emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    for (const room in usersInRooms) {
      usersInRooms[room] = usersInRooms[room].filter((user) => user.id !== socket.id);
      io.to(room).emit("update_user_list", usersInRooms[room]);
    }
    console.log(`❌ User Disconnected: ${socket.id}`);
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
