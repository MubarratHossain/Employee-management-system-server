require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');

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
    const workCollection = database.collection("work"); 

    // JWT Generation endpoint
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '180h' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).json({ success: true, token });
    });

    // Logout endpoint
    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      });

      res.status(200).json({ success: true, message: 'Logged out successfully' });
    });

    // Register user endpoint
    app.post('/users', async (req, res) => {
      try {
        const { email, password, username, bankAccountNumber, accountType, uploadedPhoto, salary } = req.body;
    
        const existingUser = await usersCollection.findOne({ email });
    
        if (existingUser) {
          return res.status(200).json({
            message: "User already exists",
            user: {
              email: existingUser.email,
              username: existingUser.username,
              accountType: existingUser.accountType,
              bankAccountNumber: existingUser.bankAccountNumber,
              uploadedPhoto: existingUser.uploadedPhoto,
              salary: existingUser.salary,
            },
          });
        }
    
        let hashedPassword = null;
        if (password) {
          hashedPassword = await bcrypt.hash(password, 10);
        }
    
        const user = {
          email,
          password: hashedPassword, // Can be null for Google users
          username: username || "New Employee",
          bankAccountNumber: bankAccountNumber || "",
          accountType: accountType || "Employee",
          uploadedPhoto: uploadedPhoto || "",
          salary: salary || (accountType === "HR" ? 50000 : 30000),
          createdAt: new Date(),
        };
    
        const result = await usersCollection.insertOne(user);
    
        res.status(201).json({
          message: "User registered successfully",
          user: {
            email: user.email,
            username: user.username,
            accountType: user.accountType,
            bankAccountNumber: user.bankAccountNumber,
            uploadedPhoto: user.uploadedPhoto,
            salary: user.salary,
          },
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error registering user" });
      }
    });
    

    // Verify token middleware
    const verifyToken = (req, res, next) => {
      const token = req.cookies.token;
      if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attaching user info to the request
        next(); // Pass control to the next handler
      } catch (err) {
        console.error("Token verification failed:", err);
        res.status(401).json({ message: "Invalid or expired token." });
      }
    };

    // Example: Protect the /users route
    app.get('/users', verifyToken, async (req, res) => {
      try {
        // The user info is now attached to req.user
        const users = await usersCollection.find().toArray();
        res.json(users);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching users' });
      }
    });
   

    // Example: Get user by email
// Route to fetch user data by email
app.get('/users/:email', verifyToken, async (req, res) => {
  try {
    const email = req.params.email.trim().toLowerCase(); // Optional: Normalize and convert to lowercase
    console.log("Searching for user with mail:", email); // Log the email being searched

    // Using case-insensitive query
    const user = await usersCollection.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      email: user.email,
      username: user.username,
      accountType: user.accountType,
      bankAccountNumber: user.bankAccountNumber,
      uploadedPhoto: user.uploadedPhoto,
      salary: user.salary,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});
// Backend: Verify employee
app.patch('/users/:email', verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    const { isVerified } = req.body; // Expecting isVerified to be true
    
    const user = await usersCollection.findOneAndUpdate(
      { email },
      { $set: { isVerified } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user); // Return updated user data
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ message: "Error verifying user" });
  }
});
app.put('/users/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { password, bankAccountNumber } = req.body;

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let updateData = { bankAccountNumber };
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    await usersCollection.updateOne({ email }, { $set: updateData });

    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating user" });
  }
});



app.get('/work/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const workEntries = await workCollection.find({ userId: new ObjectId(userId) }).toArray();
    res.status(200).json(workEntries);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching work entries' });
  }
});

// 2. Add a new work entry (POST /work)
app.post('/work', async (req, res) => {
  const { task, hoursWorked, date, userId, userEmail } = req.body;

  try {
    // Insert the new work entry into the MongoDB collection
    const result = await workCollection.insertOne({
      task,
      hoursWorked,
      date: new Date(date), // Store the date as a Date object
      userId: new ObjectId(userId), // Make sure userId is an ObjectId
      userEmail // Store the user's email
    });
    
    // Retrieve the inserted document
    const newWorkEntry = await workCollection.findOne({ _id: result.insertedId });

    // Return the newly created entry
    res.status(201).json(newWorkEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error adding work entry' });
  }
});



// 3. Update a work entry (PUT /work/:id)
app.put('/work/:id', async (req, res) => {
  const { id } = req.params;
  const { task, hoursWorked, date } = req.body;

  try {
    const result = await workCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { task, hoursWorked, date: new Date(date) },
      }
    );
    
    if (result.matchedCount > 0) {
      res.status(200).json({ message: 'Work entry updated successfully' });
    } else {
      res.status(404).json({ error: 'Work entry not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error updating work entry' });
  }
});
app.get('/work', async (req, res) => {
  try {
    // Fetch all work entries from the collection
    const workEntries = await workCollection.find().toArray();
    
    // Return all work entries
    res.status(200).json(workEntries);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching work entries for all users' });
  }
});

// 4. Delete a work entry (DELETE /work/:id)
app.delete('/work/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await workCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount > 0) {
      res.status(200).json({ message: 'Work entry deleted successfully' });
    } else {
      res.status(404).json({ error: 'Work entry not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error deleting work entry' });
  }
});












   
   

    // Example: Profile route protected by verifyToken middleware
    app.get('/profile', verifyToken, (req, res) => {
      res.json({ message: 'Welcome to your profile', user: req.user });
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

// Token validation route
app.get('/validate-token', (req, res) => {
  const token = req.cookies.token;
  console.log('Received Token:', token);

  if (!token) {
    return res.status(401).json({ isValid: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded Token:', decoded);
    res.json({ isValid: true });
  } catch (err) {
    console.error("Token verification failed:", err);
    res.status(401).json({ isValid: false });
  }
});

app.get('/', (req, res) => {
  res.send('Hello, Express Server is Running🚀');
});

app.listen(PORT, () => console.log(`🚀Server running on http://localhost:${PORT}`)); 
