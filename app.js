const express = require('express')
const multer = require('multer')
const app = express()
const port = 3000

const deviceRouter = require('./routes/device')
app.use('/device',deviceRouter)
let upload = multer()
app.use(upload.any())
app.post('/', (req, res) => {
    console.log(req.files)
    res.send('Hello World www')

})
app.listen(port, ()=> { 
    console.log(`Example app listening at http://localhost:${port}`)
})