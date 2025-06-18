# TODO List App

A simple TODO list web application with user authentication, built with Node.js, Express, SQLite, and EJS templates.

---

## Features

- User registration and login with password hashing (bcrypt)
- Create, view, and delete personal TODO tasks
- Mark tasks as completed with checkbox toggle
- Change password and reset forgotten password functionality
- Session-based authentication with Express sessions
- Responsive UI styled with Bootstrap 5
- Data persisted in SQLite database (`data.db`)

---

## Tech Stack

- Node.js
- Express.js
- SQLite (with `sqlite3` npm package)
- EJS templating engine
- bcrypt for password hashing
- Bootstrap 5 for styling

---

## Setup & Run

1. Clone the repository

   ```bash
   git clone <repository-url>
   cd <repository-folder>

2. Install dependencies

	```bash
	npm install

3. Start the app

	```bash
	node server.js

4. Open your browser and visit: 
	```
	http://localhost:3000
	```

Docker

1. Build the Docker image:

	```bash
	docker build -t todo-app .

2. Run the container:


	```bash
	docker run -p 3000:3000 todo-app
