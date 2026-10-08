process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const redisClient = require('./redisClient');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express')
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sequelize, User, Todo } = require('./models');
const apiLimiter = require('./rateLimiter');

const corsOptions = {
    origin: 'http://localhost:3000',

    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],

    allowedHeaders: ['Content-Type', 'Authorization'],

    credentials: true,
};

const app = express()

app.set('trust proxy', 1);
app.use(express.json());
app.use(helmet());
app.use(apiLimiter);
app.use(cors(corsOptions));

// code to test for cors
// fetch('http://localhost/todos', { method: 'GET' })
//   .then(res => res.json())
//   .then(data => console.log('Success:', data))
//   .catch(err => console.error('CORS Error:', err));

const cookieParser = require('cookie-parser');
app.use(express.json());
app.use(cookieParser());


app.use(session({
    secret: process.env.JWT_SECRET || 'super_session_secret',
    resave: false,
    saveUninitialized: true
}));

// 2. Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost/auth/google/callback",
    state: false
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Find or create user in MySQL
            let user = await User.findOne({ where: { googleId: profile.id } });

            if (!user) {
                user = await User.findOne({ where: { email: profile.emails[0].value } });

                if (user) {
                    user.googleId = profile.id;
                    await user.save();
                } else {
                    user = await User.create({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id
                    });
                }
            }

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }
));

// Serialization / Deserialization
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// 4. Passport Session Serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// --- ROUTES ---

// Route 1: Direct user to Google's sign-in page
// Callback route
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);


app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: false }),
    (req, res) => {
        // Safety guard
        if (!req.user) {
            return res.redirect('/login');
        }

        // 1. Sign your JWT payload
        const token = jwt.sign(
            { id: req.user.id, uuid: req.user.uuid },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 2. Set the cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // 👈 Change from 'strict' to 'lax' for OAuth redirects
            maxAge: 24 * 60 * 60 * 1000
        });

        // 3. Send response or redirect
        return res.json({ message: "Google Auth successful!", user: req.user });
    }
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const basicAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // 1. Check if Authorization header exists and starts with 'Basic '
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        // 2. Extract Base64 string and decode it
        const base64Credentials = authHeader.split(' ')[1];
        const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');

        // 3. Split into email and password
        const [email, password] = decodedCredentials.split(':');

        if (!email || !password) {
            return res.status(400).json({ error: 'Invalid auth format' });
        }

        // 4. Look up user in MySQL
        const user = await User.findOne({ where: { email } });
        if (!user || !user.password) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // 5. Compare password with bcrypt hash
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // 6. Attach user object to request and proceed
        req.user = user;
        next();

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error during Basic Auth' });
    }
};

const authenticateToken = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET || 'super_secret', async (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });

        try {
            const user = await User.findByPk(decoded.id);

            if (!user) return res.status(404).json({ error: 'User not found' });

            req.user = user;
            next();
        } catch (dbErr) {
            return res.status(500).json({ error: 'Database error during authentication' });
        }
    });
};


app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // 1. Generate the JWT
        const token = jwt.sign(
            { id: user.id, uuid: user.uuid },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 2. Set the cookie on the response
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        });

        return res.json({
            message: 'Login successful!',
            user: {
                id: user.id,
                uuid: user.uuid,
                name: user.name,
                email: user.email
            }
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Something went wrong during login' });
    }
});

app.post('/users', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // 1. Basic validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // 2. Check if the user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered' });
        }

        // 3. Hash the password securely
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create the new user in MySQL
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        });

        // 5. Respond (exclude password from the returned JSON for security)
        return res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                uuid: newUser.uuid,
                name: newUser.name,
                email: newUser.email
            }
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Something went wrong' });
    }
});

app.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.findAll({ include: 'todos' })
        return res.json(users)
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

app.get('/users/:uuid', authenticateToken, async (req, res) => {
    const uuid = req.params.uuid
    try {
        const user = await User.findOne({
            where: { uuid },
            include: 'todos'
        })
        return res.json(user)
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

app.post('/todos', authenticateToken, async (req, res) => {
    try {
        const { title, description, isComplete } = req.body;

        // 1. Create the new todo with all fields in MySQL
        const newTodo = await Todo.create({
            title,
            description,
            isComplete,
            userId: req.user.id
        });

        // 2. Clear the Redis cache for this user
        const cacheKey = `todos:user:${req.user.id}`;
        await redisClient.del(cacheKey);
        console.log(`🧹 [REDIS] Cache invalidated for key: ${cacheKey}`);

        // 3. Return the created todo
        return res.status(201).json(newTodo);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

app.get('/todos', authenticateToken, async (req, res) => {
    res.set('Cache-Control', 'public, max-age=30');

    // 1. Create a unique cache key per logged-in user
    const cacheKey = `todos:user:${req.user.id}`;

    try {
        // 2. Check if cached data exists in Redis
        const cachedTodos = await redisClient.get(cacheKey);

        if (cachedTodos) {
            console.log('⚡ [REDIS] Cache Hit! Serving instantly from memory');
            return res.json({
                servedByPort: PORT,
                todos: JSON.parse(cachedTodos)
            });
        }

        // 3. Cache Miss: Fetch from MySQL/Sequelize
        console.log('🐢 [MYSQL] Cache Miss! Fetching from database...');
        const todos = await Todo.findAll({ where: { userId: req.user.id } });

        // 4. Save to Redis with a 60-second TTL
        await redisClient.set(cacheKey, JSON.stringify(todos), { EX: 60 });

        return res.json({
            servedByPort: PORT,
            todos
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/todos/:uuid', authenticateToken, async (req, res) => {
    const uuid = req.params.uuid
    try {
        const todo = await Todo.findOne({
            where: { uuid },
            include: 'user'
        })
        return res.json(todo)
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

app.put('/todos/:id', authenticateToken, async (req, res) => {
    try {
        const { title, description, isCompleted } = req.body;

        // Find todo matching both the URL id AND the user's ID
        const todo = await Todo.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!todo) {
            return res.status(404).json({ error: 'Todo not found or unauthorized' });
        }

        await todo.update({ title, description, isCompleted });

        const cacheKey = `todos:user:${req.user.id}`;
        await redisClient.del(cacheKey);
        console.log(`🧹 [REDIS] Cache invalidated for key: ${cacheKey}`);

        return res.json(todo);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update todo' });
    }
});

app.delete('/todos/:id', authenticateToken, async (req, res) => {
    try {
        const deletedCount = await Todo.destroy({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!deletedCount) {
            return res.status(404).json({ error: 'Todo not found or unauthorized' });
        }

        const cacheKey = `todos:user:${req.user.id}`;
        await redisClient.del(cacheKey);
        console.log(`🧹 [REDIS] Cache invalidated for key: ${cacheKey}`);

        return res.json({ message: 'Todo deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to delete todo' });
    }
});

app.put('/users/:id', authenticateToken, async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // 1. Safety check: Ensure users can ONLY update their own profile!
        if (req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Unauthorized to update this user' });
        }

        // 2. Prepare update data
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;

        // 3. Only hash and update password IF a new password was provided
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // 4. Update the user model instance attached to req.user
        await req.user.update(updateData);

        return res.json(req.user);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Something went wrong' });
    }
});

app.delete('/users/:id', authenticateToken, async (req, res) => {
    try {
        // 1. Safety Check: Ensure the user is only deleting THEIR OWN account
        if (req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Unauthorized to delete this account' });
        }

        // 2. Destroy the user record attached to req.user
        await req.user.destroy();

        return res.json({ message: 'User account deleted successfully' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Something went wrong' });
    }
});

app.get('/basic-protected', basicAuth, (req, res) => {
    return res.json({
        message: `Hello ${req.user.name}, you logged in using Basic Auth!`,
        user: req.user
    });
});

app.post('/logout', (req, res) => {
    res.clearCookie('token');
    return res.json({ message: 'Logged out successfully' });
});

app.listen({ port: 5000 }, async () => {
    await console.log('Server up on http://localhost5000')
    await sequelize.authenticate()
        .then(() => {
            console.log('Database connected!')
            return sequelize.sync()
        })
        .then(() => { console.log('Database updated successfully') })
        .catch(err => {
            console.log('Error: ' + err)
        })
})