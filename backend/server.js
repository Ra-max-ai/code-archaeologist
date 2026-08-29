const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('Code Archaeologist backend is running!');
});

app.listen(4000, () => {
  console.log('Backend running on http://localhost:4000');
});
