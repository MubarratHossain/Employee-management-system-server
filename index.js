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
    const payrollCollection = database.collection("payroll");
    const messagesCollection = database.collection("messages");
  
   
    

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
app.patch("/users/admin/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Convert id to MongoDB ObjectId
    const objectId = new ObjectId(id);

    // Update user role to Admin
    const result = await usersCollection.updateOne(
      { _id: objectId },
      { $set: { accountType: "Admin" } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User promoted to Admin successfully" });
  } catch (error) {
    console.error("Error making user admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.patch("/users/employee/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Convert id to MongoDB ObjectId
    const objectId = new ObjectId(id);

    // Update user role to Admin
    const result = await usersCollection.updateOne(
      { _id: objectId },
      { $set: { accountType: "HR" } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User promoted to HR successfully" });
  } catch (error) {
    console.error("Error making user HR:", error);
    res.status(500).json({ message: "Internal server error" });
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

app.delete("/users/:id", async (req,res) =>{
  const id =req.params.id;
  const query ={_id: new ObjectId(id)}
    const result= await usersCollection.deleteOne(query);
    res.send(result);
 
})

app.patch("/users/fire/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      isFired: true, // Mark the user as fired
      accountType: "Fired", // Optionally change accountType or add a fired status field
    },
  };
  try {
    const result = await usersCollection.updateOne(query, updateDoc);
    if (result.modifiedCount > 0) {
      res.status(200).send({ message: "User fired successfully!" });
    } else {
      res.status(400).send({ message: "Failed to fire user" });
    }
  } catch (error) {
    console.error("Error firing user:", error);
    res.status(500).send({ message: "Server error" });
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
  const { task, hoursWorked, date, userId, userEmail,username } = req.body;

  try {
    // Insert the new work entry into the MongoDB collection
    const result = await workCollection.insertOne({
      task,
      hoursWorked,
      date: new Date(date), // Store the date as a Date object
      userId: new ObjectId(userId), // Make sure userId is an ObjectId
      userEmail,
      username, // Store the user's email
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
app.get('/work', async (req, res) => {
  try {
    // Retrieve all work entries from the collection
    const workEntries = await workCollection.find().toArray();

    // Return the list of work entries
    res.status(200).json(workEntries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching work entries' });
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



app.get("/payroll", verifyToken, async (req, res) => {
  try {
    const payrollRecords = await payrollCollection.find().toArray();
    res.status(200).json(payrollRecords);
  } catch (error) {
    console.error("Error fetching payroll records:", error);
    res.status(500).json({ message: "Error fetching payroll records" });
  }
});

// Create a payroll entry (HR only)
app.post("/payroll", verifyToken, async (req, res) => {
  try {
    const { email, name, salary, month, year, status } = req.body;

    // Ensure no duplicate entry for the same employee in the same month & year
    const existingRecord = await payrollCollection.findOne({ email, month, year });
    if (existingRecord) {
      return res.status(400).json({ message: "Payroll already exists for this employee in this month." });
    }

    const payrollEntry = {
      email,
      name,
      salary,
      month,
      year,
      status: status || "Pending Approval",
      paymentDate: null,
    };

    const result = await payrollCollection.insertOne(payrollEntry);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating payroll record:", error);
    res.status(500).json({ message: "Error creating payroll record" });
  }
});

// Process payment
app.patch("/payroll/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate } = req.body;
    const objectId = new ObjectId(id);

    const result = await payrollCollection.updateOne(
      { _id: objectId },
      { $set: { status: "Paid", paymentDate } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Payroll record not found" });
    }

    res.json({ message: "Payment processed successfully" });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ message: "Error processing payment" });
  }
});



app.patch("/payroll/increase-salary/:email", verifyToken, async (req, res) => {
  try {
    const { email } = req.params;

    // Find the latest payroll record for the employee
    const latestPayroll = await payrollCollection.findOne(
      { email },
      { sort: { year: -1, month: -1 } }
    );

    if (!latestPayroll) {
      return res.status(404).json({ message: "Payroll record not found for this employee" });
    }

    // Increase salary by 5000
    const newSalary = latestPayroll.salary + 5000;

    // Update salary in payroll collection
    await payrollCollection.updateMany(
      { email, year: { $gte: latestPayroll.year }, month: { $gte: latestPayroll.month } },
      { $set: { salary: newSalary } }
    );

    // Update salary in users collection
    const userUpdateResult = await usersCollection.updateOne(
      { email },
      { $set: { salary: newSalary } }
    );

    if (userUpdateResult.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Salary increased successfully", newSalary });
  } catch (error) {
    console.error("Error updating salary:", error);
    res.status(500).json({ message: "Error updating salary" });
  }
});
    

app.patch('/users/increase-salary/:email', verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    const usersCollection = database.collection('users');  // Assuming 'users' collection exists

    const user = await usersCollection.findOne({ email, accountType: 'HR' });

    if (!user) {
      return res.status(404).json({ message: 'HR user not found' });
    }

    const newSalary = user.salary + 1000;  // Example: increase salary by 1000 (adjust logic as needed)

    const updatedUser = await usersCollection.updateOne(
      { email },
      { $set: { salary: newSalary } }
    );

    if (updatedUser.modifiedCount === 0) {
      return res.status(500).json({ message: 'Failed to increase salary' });
    }

    // Respond with the new salary
    res.json({ newSalary });

  } catch (error) {
    console.error('Error increasing salary:', error);
    res.status(500).json({ message: 'Failed to increase salary' });
  }
});



app.patch('/users/pay/:email', verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    const { paymentDate, paymentMonth, paymentYear } = req.body;

    const usersCollection = database.collection('users'); // Assuming 'users' collection exists

    // Find HR user
    const user = await usersCollection.findOne({ email, accountType: 'HR' });

    if (!user) {
      return res.status(404).json({ message: 'HR user not found' });
    }

    // Check if the payment for the month and year already exists
    if (user.payments?.some(p => p.paymentMonth === paymentMonth && p.paymentYear === paymentYear)) {
      return res.status(400).json({ message: `Payment for ${paymentMonth} ${paymentYear} has already been processed!` });
    }

    // Add a new payment entry to the payments array
    const paymentEntry = {
      paymentDate,
      paymentMonth,
      paymentYear,
      salary: user.salary // Store the salary for the given month
    };

    const updateResult = await usersCollection.updateOne(
      { email },
      { 
        $push: { payments: paymentEntry } // Add new payment to the payments array
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ message: 'Failed to process payment' });
    }

    res.json({ 
      email, 
      paymentDate, 
      paymentMonth, 
      paymentYear,
      salary: user.salary,
      message: 'Payment processed successfully' 
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ message: 'Failed to process payment' });
  }
});



app.post("/api/messages", async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message) {
      return res.status(400).json({ success: false, error: "Email and message are required" });
    }

    const newMessage = { email, message, createdAt: new Date() };
    await messagesCollection.insertOne(newMessage);

    res.status(201).json({ success: true, message: "Message stored successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Retrieve visitor messages
app.get("/api/messages", async (req, res) => {
  try {
    const messages = await messagesCollection.find().sort({ createdAt: -1 }).toArray();
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



















   
   

    // Example: Profile route protected by verifyToken middleware
    app.get('/profile', verifyToken, (req, res) => {
      res.json({ message: 'Welcome to your profile', user: req.user });
    });

  } catch (error) {
    console.error("Error connecting to Mongo:", error);
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
