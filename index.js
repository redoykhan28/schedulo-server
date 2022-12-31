const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000

//middlewear
app.use(cors())
app.use(express.json())

//middlewear for varify jwt
function jwtVerify(req, res, next) {

    const authHeader = req.headers.authorization;
    // console.log(authHeader)
    if (!authHeader) {

        return res.status(401).send('Unothorized User')
    }

    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {

        if (error) {

            return res.status(403).send('Forbbiden access')
        }

        req.decoded = decoded

        next()

    })

}

app.get('/', (req, res) => {

    res.send('Schedulo Running on Server')
})

//using mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ytkvvxy.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {

    try {

        //create collection of users
        const usersCollection = client.db('Schedulo').collection('users')
        //create collection of timeslots
        const slotsCollection = client.db('Schedulo').collection('timeSlots')
        //create collection of timeslots
        const bookingCollection = client.db('Schedulo').collection('bookings')
        //create collection of timeslots
        const servicesCollection = client.db('Schedulo').collection('services')


        //verify admin
        const verifyAdmin = async (req, res, next) => {

            //verify
            const decodedEmail = req.decoded.email;
            const AdminQuery = { email: decodedEmail }
            const user = await usersCollection.findOne(AdminQuery)

            if (user?.role !== 'admin') {

                return res.status(403).send('Forbidden Access');
            }
            next()

        }

        //verify customer
        const verifyCustomer = async (req, res, next) => {

            //verify
            const decodedEmail = req.decoded.email;
            const CustomerQuery = { email: decodedEmail }
            const user = await usersCollection.findOne(CustomerQuery)

            if (user?.role !== 'customer') {

                return res.status(403).send('Forbidden Access');
            }
            next()

        }

        //post users
        app.post('/users', async (req, res) => {

            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.post('/booking', jwtVerify, async (req, res) => {

            const booking = req.body
            const result = await bookingCollection.insertOne(booking)
            res.send(result)
        })


        //get jwt by user email
        app.get('/jwt', async (req, res) => {

            const email = req.query.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)

            //send jwt to client
            if (user) {

                const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '30d' })
                return res.send({ accessToken: token })

            }

            res.status(403).send({ accessToken: '' })

        })

        //get admin  to authorized route
        app.get('/user/admin/:email', async (req, res) => {

            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            res.send({ isAdmin: result?.role === 'admin' })

        })

        //get customer  to authorized route
        app.get('/user/customer/:email', async (req, res) => {

            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            res.send({ isCustomer: result?.role === 'customer' })

        })

        //get time with aggrigate with booking
        app.get('/slots', async (req, res) => {

            const date = req.query.date
            const query = {}
            const result = await slotsCollection.find(query).toArray()
            const bookingQuery = { date: date }
            const alreadyBooked = await bookingCollection.find(bookingQuery).toArray()
            result.forEach(result => {
                const bookrdSlot = alreadyBooked.map(book => book?.slots)
                const remainingSlot = result.slots.filter(slot => !bookrdSlot.includes(slot))
                result.slots = remainingSlot
            })
            res.send(result)
        })

        //get user booking by email
        app.get('/myBooking', jwtVerify, verifyCustomer, async (req, res) => {

            const email = req.query.email;
            const query = { email: email }
            const result = await bookingCollection.find(query).sort({ _id: -1 }).toArray()
            res.send(result)

        })

        //get services
        app.get('/services', async (req, res) => {
            const query = {};
            const result = await servicesCollection.find(query).toArray()
            res.send(result)
        })


        //get all booking
        app.get('/allbooking', jwtVerify, verifyAdmin, async (req, res) => {

            const query = {}
            const result = await bookingCollection.find(query).toArray()
            res.send(result)
        })

        //get booking by id
        app.get('/booking/:id', jwtVerify, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await bookingCollection.findOne(query)
            res.send(result)
        })

        //get all users
        app.get('/users', jwtVerify, verifyAdmin, async (req, res) => {

            const query = {}
            const result = await usersCollection.find(query).toArray()
            res.send(result)
        })

        //cancel user booking
        app.delete('/cancelUserBooking/:id', jwtVerify, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await bookingCollection.deleteOne(query)
            res.send(result)
        })

        //create admin
        app.put('/admin/:id', jwtVerify, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {

                $set: {
                    role: 'admin'
                }
            }

            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })


        //update booking status to confirm
        app.put('/acceptStatus/:id', jwtVerify, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {

                $set: {
                    status: 'Confirmed'
                }
            }

            const result = await bookingCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        //update booking status to cancel
        app.put('/cancelStatus/:id', jwtVerify, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {

                $set: {
                    status: 'Canceled'
                }
            }

            const result = await bookingCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        app.put('/updateBooking/:id', jwtVerify, async (req, res) => {

            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const updateBooking = req.body
            const option = { upsert: true }
            const update = {
                $set: {

                    name: updateBooking.name,
                    email: updateBooking.email,
                    slots: updateBooking.slots,
                    date: updateBooking.date,
                    treatment: updateBooking.treatment,
                    note: updateBooking.note,
                    status: updateBooking.status
                }
            }

            const result = await bookingCollection.updateOne(query, update, option)
            res.send(result)
        })

    }

    finally {

    }
}

run().catch(console.dir)



app.listen(port, () => {

    console.log(`Schedulo runs on port ${port}`)

})
