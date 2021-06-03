const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const log = require('npmlog');
const app = express();
const port = 3000;



const deviceRouter = require('./routes/device');
const personRouter = require('./routes/person');
const alertRouter = require('./routes/alert');
const entryRouter = require('./routes/entry');
const authRouter = require('./routes/app-auth');
const houseRouter = require('./routes/house');
const keyRouter = require('./routes/key');

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

app.use('/device',deviceRouter);
app.use('/person',personRouter);
app.use('/alert',alertRouter);
app.use('/entry',entryRouter);
app.use('/app',authRouter);
app.use('/house',houseRouter);
app.use('/key', keyRouter);


app.listen(port, ()=> { 
    log.info('SERVER',`APP listening at http://localhost:${port}`)
})