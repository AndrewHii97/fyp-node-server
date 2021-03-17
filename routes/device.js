const express = require('express');
const db = require('../db');
const multer = require('multer');
const deviceRouter = express.Router();
const {BUCKET_NAME, uploadToBucket} = require('../modules/s3-bucket')

upload = multer();

// use build in body parser from express
deviceRouter.use(express.json());
deviceRouter.use(express.urlencoded({
    extended: true 
}));
deviceRouter.use(upload.any())

// authentication for each device 
deviceRouter.use('/',async (req,res,next)=>{
    let deviceName = req.body.device_name; // device_name 
    let password = req.body.password; // device password  
    console.log(`deviceName : ${deviceName} ; password : ${password}`);
    try{ 
        data = await db.one({
            name: 'authenticate-device',
            text: 'SELECT * FROM Devices WHERE deviceName = $1 AND devicepassword = $2',
            values: [deviceName, password]
        })
        console.log('DATA',data);
        req.body.id = data.deviceid;
        next();
    }catch(err){
        console.log('ERROR:',error);
        res.status(401).json({error:"401",message:"authentication fail"})
    }
});

// getRfidKeyOwner 
// error generated need to be catch when using this function 
async function getRfidKeyOwner(rfid){ 
    let data = await db.any({
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
    });
    return data; 
}

// check rfid key exists if true open the door 
deviceRouter.post('/rfid-check',async (req,res)=>{
    console.log(req.body);
    let rfid = req.body.rfid
    // modify to return list of valid key user 
    try{
        keyOwner = await getRfidKeyOwner(rfid);
        console.log('DATA',keyOwner);
        res.json({
            "status": true, 
            "keyowner": keyOwner 
        });
    }catch(err){ 
        console.log(err);
        res.json({
            "status": false, 
            "message": `${rfid} does not exist`
        });
        
    }
})

async function insertEntryPhoto(fileName){
        // Insert entry photo which does not have any person information
        db.none({
            name: 'insert-photo-table',
            text: 'INSERT INTO photos(photopath) VALUES ($1)',
            values: [fileName]
        })
}

// '/upload-pic' route to upload image to s3 & update databases with key 
deviceRouter.post('/upload-pic',async (req,res,next)=>{
    console.log("Store image to s3")
    req.files.forEach( async (file)=>{
        try{ 
            let s3Response = await uploadToBucket(file.fieldname,BUCKET_NAME,file.buffer);
            console.log(s3Response);
            await insertEntryPhoto(file.fieldname)
        }catch(err){ 
            console.log(err);
            res.send(err)
            next('router')
        }
    })
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

async function getPhotoPath(photoid){ 
    const photoPath = await db.one({ 
        name: 'get-photo-key',
        text: 'SELECT photopath FROM Photos where photoid = ($1)',
        values: [photoid]
    })
    return photoPath
}


module.exports = deviceRouter;