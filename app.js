const express = require('express')
const multer = require('multer')
const morgan = require('morgan')
const log = require('npmlog')
const app = express()
const port = 3000


const deviceRouter = require('./routes/device')
app.use(morgan('dev'))
app.use('/device',deviceRouter)


app.listen(port, ()=> { 
    log.info('SERVER',`APP listening at http://localhost:${port}`)
})