const express = require('express')
const multer = require('multer')
const app = express()
const port = 3000

const deviceRouter = require('./routes/device')
app.use('/device',deviceRouter)

app.listen(port, ()=> { 
    console.log(`Example app listening at http://localhost:${port}`)
})