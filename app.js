const express = require('express')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sequelize, User, Todo } = require('./models');

const app = express()
app.use(express.json())

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const secretKey = 'my_super_secret_key';
        const decoded = jwt.verify(token, secretKey);

        const user = await User.findOne({ where: { uuid: decoded.uuid } });
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists.' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.log(err);
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
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
        const secretKey = 'my_super_secret_key';
        const token = jwt.sign(
            { uuid: user.uuid },
            secretKey,
            { expiresIn: '24h' }
        );
        return res.json({
            message: 'Login successful!',
            token,
            user: {
                uuid: user.uuid,
                name: user.name,
                email: user.email
            }
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json('Something went wrong during login');
    }
});

app.post('/users', async (req, res) => {
    const { name, email, password } = req.body
    try {
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await User.create({ name, email, password: hashedPassword })
        return res.json(user)
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

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
    const { title, description, isCompleted, userUuid } = req.body
    try {
        const user = await User.findOne({ where: { uuid: userUuid } })

        const todo = await Todo.create({ title, description, isCompleted, userId: user.id })
        return res.json(todo)
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

app.get('/todos', authenticateToken, async (req, res) => {
    try {
        const todos = await Todo.findAll()
        return res.json(todos)
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

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

app.put('/todos/:uuid', authenticateToken, async (req, res) => {
    const uuid = req.params.uuid
    const { title, description, isCompleted } = req.body
    try {
        const todo = await Todo.findOne({ where: { uuid } })
        todo.title = title
        todo.description = description
        todo.isCompleted = isCompleted
        await todo.save()
        return res.json(todo)
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

app.delete('/todos/:uuid', authenticateToken, async (req, res) => {
    const uuid = req.params.uuid
    try {
        const todo = await Todo.findOne({ where: { uuid } })
        await todo.destroy()
        return res.json({ message: 'Task deleted' })
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

app.put('/users/:uuid', authenticateToken, async (req, res) => {
    const uuid = req.params.uuid
    const { name, email, password } = req.body
    try {
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await User.findOne({ where: { uuid } })
        user.name = name
        user.email = email
        user.password = hashedPassword
        await user.save()
        return res.json(user)
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

app.delete('/users/:uuid', authenticateToken, async (req, res) => {
    const uuid = req.params.uuid
    try {
        const user = await User.findOne({ where: { uuid } })
        await user.destroy()
        return res.json({ message: 'User deleted' })
    } catch (err) {
        console.log(err)
        return res.status(500).json('Something went wrong')
    }
})

app.listen({ port: 5000 }, async () => {
    console.log('Server up on http://localhost5000')
    await sequelize.authenticate()
        .then(() => {
            console.log('Database connected!')
            return sequelize.sync({ alter: true })
        })
        .then(() => { console.log('Database updated successfully') })
        .catch(err => {
            console.log('Error: ' + err)
        })
})