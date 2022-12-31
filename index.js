const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000

//middlewear
app.use(cors())
app.use(express.json())

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

        //post users
        app.post('/users', async (req, res) => {

            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.post('/booking', async (req, res) => {

            const booking = req.body
            const result = await bookingCollection.insertOne(booking)
            res.send(result)
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
        app.get('/myproduct', async (req, res) => {

            const email = req.query.email;
            const query = { email: email }
            const result = await bookingCollection.find(query).sort({ _id: -1 }).toArray()
            res.send(result)

        })

        //cancel user booking

        app.delete('/cancelUserBooking/:id', async (req, res) => {

            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await bookingCollection.deleteOne(query)
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
