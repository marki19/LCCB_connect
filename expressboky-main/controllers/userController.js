const db = require('../db');

exports.getUserHome = (req, res) => {
  res.send('User Home Route');
};

exports.getUserProfile = (req, res) => {
  res.send('User Profile Page');
};

exports.getUserSettings = (req, res) => {
  res.send('User Settings Page');
};

exports.addUser = async (req, res) => {
  try {
    const { username, firstname } = req.body;

    if (!username || !firstname) {
      return res.status(400).json({ message: "Username and firstname are required" });
    }

    const [result] = await db.execute(
      'INSERT INTO tbl_users (username, firstname) VALUES (?, ?)',
      [username, firstname]
    );

    res.json({
      id: result.insertId,
      username,
      firstname,
      message: "User added successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, username, firstname FROM tbl_users');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      'SELECT id, username, firstname FROM tbl_users WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
};
