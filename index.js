require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());





const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    const database = client.db("usersDB");
    const usersCollection = database.collection('users');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '180h' });
    
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).json({ success: true, token }); 
    });
    
  
    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

      });

      res.status(200).json({ success: true, message: 'Logged out successfully' });
    });
    
   

 







    app.post('/users', async (req, res) => {
      try {
        const { email, password, username, bankAccountNumber, accountType, uploadedPhoto, salary } = req.body;
    
        
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ message: 'Email already exists' });
        }
    
        
        const user = {
          email,
          password,
          username,
          bankAccountNumber,
          accountType,
          uploadedPhoto,
          salary: accountType === 'HR' ? 50000 : 30000,
          createdAt: new Date(),
        };
    
        const result = await usersCollection.insertOne(user);
        res.status(201).json({ message: 'User registered successfully', userId: result.insertedId });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering user' });
      }
    });



} catch (error) {
  console.error("Error connecting to MongoDB:", error);
}
}


run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello, Express Server is Running🚀');
});

app.listen(PORT, () => console.log(`🚀Server running on http://localhost:${PORT}`));
