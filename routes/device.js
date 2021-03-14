const express = require('express');
const db = require('../db');
const multer = require('multer');


const deviceRouter = express.Router();
const upload = multer();
// use build in body parser from express
deviceRouter.use(express.json());
deviceRouter.use(express.urlencoded({
    extended: true 
}));
deviceRouter.use(upload.any())

// authentication for each device 
deviceRouter.use('/',(req,res,next)=>{
    let deviceName = req.body.device_name; // device_name 
    let password = req.body.password; // device password  
    console.log(`deviceName : ${deviceName} ; password : ${password}`);
    db.one({
        name: 'authenticate-device',
        text: 'SELECT * FROM Devices WHERE deviceName = $1 AND devicepassword = $2',
        values: [deviceName, password]
    })
    .then((data)=>{
        //success 
        console.log('DATA',data);
        req.body.id = data.deviceid;
        next();
    })
    .catch((error,data)=>{
        //error 
        console.log('ERROR',error);
        res.status(401).json({"error":"401","message":"authentication fail"});
    })
});

// check rfid key exists if true open the door 
deviceRouter.post('/rfid-check',(req,res)=>{
    console.log(req.body);
    let rfid = req.body.rfid
    // modify to return list of valid key user 
    db.any({
        name: 'auth-rfid',
        text: `SELECT Keys.keyId, Keys.keyValue, Persons.Id as PersonId, 
            Persons.Name, PersonTypes.PersonTypeId, PersonTypes.PersonTypeName, 
            Photos.photoPath FROM 
            Keys INNER JOIN PersonsKeys ON Keys.keyId = PersonsKeys.keyId
            INNER JOIN Persons ON Persons.Id = PersonsKeys.personId 
            INNER JOIN PersonTypes ON PersonTypes.PersonTypeId = Persons.PersonTypeId
            INNER JOIN Photos ON Photos.PersonId = Persons.id 
            WHERE Keys.keyValue = $1`,
            values: [rfid]
    })
    .then((data)=>{
        // success 
        console.log('DATA',data);
        res.json({ 
            "status": true, 
            "keyowners": data  
        })
    })
    .catch((error,data)=>{
        // error 
        console.log('ERROR',error);
        res.json({
            "status": false,
            "message": `${rfid} does not exist`
        })
    })
})

// '/upload-pic' route to upload image to s3 & update databases with key 
deviceRouter.post('/upload-pic',async (req,res)=>{
    console.log('Upload picture route. Upload picture to S3');
    insertPhoto(req,res)
    res.status(200).send()
})

// '/photo-path' get the photopath given the photoid/keyid from database 
deviceRouter.post('/photo-path',async (req,res)=>{ 
    console.log("Get photo path using photoid.")
    photoid = req.body.photoid
    try { 
        data = await getPhotoPath(photoid)
        res.send(data)
    }catch(err){ // error handling  
        console.log("Error getPhotoPath")
        console.log(err)
        res.json({
            "ErrorType": "Database",
            "message": err
        })
    }
})

/*
* Database operation 
*/
// insert photo without person id 
function insertPhoto(req,res){
    req.files.forEach((file)=>{
        console.log(file)
        // insert photo data into database
        db.none({
            name: 'insert-photo-table',
            text: 'INSERT INTO photos(photopath) VALUES ($1)',
            values: [file.fieldname]
        })
        .then((data)=>{
            console.log("update database")
        })
        .catch((err,data)=>{
            console.log(err)
            res.send(err)
        })
    })
}

async function getPhotoPath(photoid){ 
    const photoPath = await db.one({ 
        name: 'get-photo-key',
        text: 'SELECT photopath FROM Photos where photoid = ($1)',
        values: [photoid]
    })
    return photoPath
}


module.exports = deviceRouter;