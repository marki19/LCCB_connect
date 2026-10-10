require("dotenv").config();
const express = require("express");

const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const userRouter = require("./routes/userRouter");
const postRouter = require("./routes/postRouter");
const thesisRouter = require("./routes/thesisRouter");

app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/theses", thesisRouter);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});