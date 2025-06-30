// server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const xmlCurlRouter = require('./routes/xmlCurl');
const apiRouter = require('./routes/api')

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/freeswitch';

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Routes
app.use('/', xmlCurlRouter);
app.use('/api', apiRouter);

// 404 Fallback
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected successfully');
  app.listen(PORT, () => {
    console.log(`FreeSWITCH XML Curl server listening on port ${PORT}`);
  });
})
.catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1); // Exit process if DB connection fails
});