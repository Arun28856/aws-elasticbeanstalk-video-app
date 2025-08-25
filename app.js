const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static HTML and JS files
app.use(express.static('public'));

// AWS Setup
AWS.config.update({ region: process.env.AWS_REGION });
const sqs = new AWS.SQS();
const sns = new AWS.SNS();

db.connect((err) => {
  if (err) {
    console.error('❌ DB connection error:', err);
  } else {
    console.log('✅ Connected to RDS');
  }
});

// ======= ROUTES =======

// Signup Route
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const query = 'INSERT INTO users (email, password, created_at) VALUES (?, ?, NOW())';

  db.query(query, [email, hashedPassword], (err, results) => {
    if (err) {
      console.error('Error inserting user:', err);
      return res.status(500).json({ message: 'Signup failed' });
    }

    console.log('✅ User signed up:', email);
    res.json({ message: 'Signup successful' });
  });
});

// Login Route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM users WHERE email = ?';

  db.query(query, [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log('✅ Login successful:', user.email);
    res.json({ message: 'Login successful', token });
  });
});

// Video Playback Success
app.post('/playback-success', async (req, res) => {
  const { username } = req.body;

  const sqsParams = {
    MessageBody: `Video played by ${username}`,
    QueueUrl: process.env.SQS_URL
  };

  const snsParams = {
    Message: `✅ Video played successfully by ${username}`,
    TopicArn: process.env.SNS_TOPIC_ARN
  };

  try {
    const sqsResult = await sqs.sendMessage(sqsParams).promise();
    console.log('📩 SQS Message Sent:', sqsResult.MessageId);

    const snsResult = await sns.publish(snsParams).promise();
    console.log('📢 SNS Notification Sent:', snsResult.MessageId);

    res.send('Message queued and notifications sent');
  } catch (err) {
    console.error('❌ Error in /playback-success:', err);
    res.status(500).send('Playback notification failed');
  }
});

// Get Signups (for testing)
app.get('/get-signups', (req, res) => {
  const query = 'SELECT id, email, created_at FROM users ORDER BY created_at DESC';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error retrieving users:', err);
      return res.status(500).json({ message: 'Error retrieving users' });
    }
    res.json(results);
  });
});

// Server Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});