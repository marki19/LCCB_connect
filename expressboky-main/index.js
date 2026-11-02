const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

const userRoutes = require('./routes/user');

app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

app.use('/user', userRoutes);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});