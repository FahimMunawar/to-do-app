const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Database connection
const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Database initialization with error handling
db.serialize(() => {
  // Check if tables exist and create them with proper schema
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    username TEXT UNIQUE NOT NULL, 
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('Users table ready');
  });
  
  db.run(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    user_id INTEGER NOT NULL, 
    task TEXT NOT NULL, 
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) console.error('Error creating todos table:', err);
    else console.log('Todos table ready');
  });
  
  // Check if completed column exists, if not add it (for existing databases)
  db.all("PRAGMA table_info(todos)", (err, columns) => {
    if (!err && columns) {
      const hasCompletedColumn = columns.some(col => col.name === 'completed');
      if (!hasCompletedColumn) {
        console.log('Adding missing completed column...');
        db.run("ALTER TABLE todos ADD COLUMN completed INTEGER DEFAULT 0", (err) => {
          if (err) console.error('Error adding completed column:', err);
          else console.log('Completed column added successfully');
        });
      }
    }
  });
});

function checkAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { message: null }));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.error('Login error:', err);
      return res.render('login', { message: "An error occurred. Please try again." });
    }
    
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.userId = user.id;
      res.redirect('/dashboard');
    } else {
      res.render('login', { message: "Invalid credentials" });
    }
  });
});

app.get('/register', (req, res) => res.render('register', { message: null }));

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  
  // Basic validation
  if (!username || !password) {
    return res.render('register', { message: "Username and password are required" });
  }
  
  const hashed = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashed], function (err) {
    if (err) {
      console.error('Registration error:', err);
      return res.render('register', { message: "User already exists" });
    }
    req.session.userId = this.lastID;
    res.redirect('/dashboard');
  });
});

app.get('/dashboard', checkAuth, (req, res) => {
  db.all("SELECT * FROM todos WHERE user_id = ? ORDER BY id DESC", [req.session.userId], (err, todos) => {
    if (err) {
      console.error('Dashboard error:', err);
      return res.render('dashboard', { todos: [] });
    }
    
    // Debug logging to check data
    console.log('Todos from database:', todos.map(t => ({ id: t.id, task: t.task, completed: t.completed })));
    
    res.render('dashboard', { todos });
  });
});

app.post('/add', checkAuth, (req, res) => {
  const task = req.body.todo;
  
  if (!task || task.trim() === '') {
    return res.redirect('/dashboard');
  }
  
  db.run("INSERT INTO todos (user_id, task, completed) VALUES (?, ?, 0)", [req.session.userId, task.trim()], (err) => {
    if (err) {
      console.error('Add todo error:', err);
    }
    res.redirect('/dashboard');
  });
});

app.post('/delete', checkAuth, (req, res) => {
  const todoId = req.body.id;
  
  db.run("DELETE FROM todos WHERE id = ? AND user_id = ?", [todoId, req.session.userId], (err) => {
    if (err) {
      console.error('Delete todo error:', err);
    }
    res.redirect('/dashboard');
  });
});

app.post('/toggle', checkAuth, (req, res) => {
  const todoId = req.body.id;

  console.log('Toggling todo ID:', todoId); // Debug log

  db.get("SELECT completed FROM todos WHERE id = ? AND user_id = ?", [todoId, req.session.userId], (err, todo) => {
    if (err) {
      console.error('Toggle select error:', err);
      return res.redirect('/dashboard');
    }
    
    if (!todo) {
      console.error('Todo not found for toggle:', todoId);
      return res.redirect('/dashboard');
    }

    console.log('Current todo state:', todo); // Debug log

    const newStatus = todo.completed ? 0 : 1;
    console.log('New status will be:', newStatus); // Debug log

    db.run("UPDATE todos SET completed = ? WHERE id = ? AND user_id = ?", [newStatus, todoId, req.session.userId], (err) => {
      if (err) {
        console.error('Toggle update error:', err);
      } else {
        console.log('Successfully updated todo', todoId, 'to completed:', newStatus);
      }
      res.redirect('/dashboard');
    });
  });
});

app.get('/change-password', checkAuth, (req, res) => {
  res.render('change-password', { message: null });
});

app.post('/change-password', checkAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  if (!oldPassword || !newPassword) {
    return res.render('change-password', { message: "Both passwords are required" });
  }
  
  db.get("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, user) => {
    if (err || !user) {
      console.error('Change password error:', err);
      return res.render('change-password', { message: "An error occurred" });
    }
    
    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.render('change-password', { message: "Old password incorrect" });
    }
    
    const newHashed = bcrypt.hashSync(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE id = ?", [newHashed, req.session.userId], (err) => {
      if (err) {
        console.error('Password update error:', err);
        return res.render('change-password', { message: "An error occurred" });
      }
      res.render('change-password', { message: "Password updated successfully" });
    });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { message: null });
});

app.post('/forgot-password', (req, res) => {
  const { username, newPassword } = req.body;
  
  if (!username || !newPassword) {
    return res.render('forgot-password', { message: "Username and new password are required" });
  }
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.error('Forgot password error:', err);
      return res.render('forgot-password', { message: "An error occurred" });
    }
    
    if (!user) {
      return res.render('forgot-password', { message: "User not found" });
    }
    
    const hashed = bcrypt.hashSync(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE username = ?", [hashed, username], (err) => {
      if (err) {
        console.error('Password reset error:', err);
        return res.render('forgot-password', { message: "An error occurred" });
      }
      res.render('forgot-password', { message: "Password reset successfully. You can now log in." });
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Handle port conflicts
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${port} is busy, trying port ${port + 1}`);
    server.listen(port + 1, () => {
      console.log(`Server running at http://localhost:${port + 1}`);
    });
  } else {
    console.error('Server error:', err);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed.');
      }
      process.exit(0);
    });
  });
});