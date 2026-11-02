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
    const [result] = await db.query(
      'INSERT INTO tbl_users (username, firstname) VALUES (?, ?)',
      [username, firstname]
    );
    res.json({ id: result.insertId, username, firstname});
  } catch (err) {
    console.error("SQL Error:", err);  
    res.status(500).json({ message: "Database error", error: err.sqlMessage });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tbl_users');
    res.json(rows);
  } catch (err) {
    console.error("SQL Error:", err);
    res.status(500).json({ message: "Database error", error: err.sqlMessage });
  }
};
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute('SELECT id, username, firstname FROM tbl_users WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
};