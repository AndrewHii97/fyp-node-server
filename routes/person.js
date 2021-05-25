const cors = require('cors');
const express = require("express");
const db = require('../db');
const multer = require('multer');
const personRouter = express.Router();
const log = require('npmlog');
const { getUrlS3Obj, BUCKETNAME } = require('../modules/s3-bucket')
log.level = 'all';
log.heading = 'person';

// middleware 
personRouter.use(express.json())
personRouter.use(express.urlencoded({
    extended: true
}))
upload = multer()
personRouter.use(cors()) // development use only
personRouter.use(upload.any())

// route 
personRouter.get('/list',async (req,res,next)=>{ 
    // get list of person information 
    try { 
        persons = await db.any({
            name: 'get persons',
            text:`
            select 
            persons.id, persons.name, persons.gender,
            persons.icno, persons.address,   persons.contactNo,
            persontypes.personTypeName,
            photos.photoid, photos.photopath
            from persons
            inner join persontypes on persons.persontypeid = persontypes.persontypeid
            inner join photospersons on persons.id = photospersons.personid
            inner join photos on photos.photoid = photospersons.photoid `
        })
        res.status(200).send(persons)
    }catch(error){ 
        log.error('GET Persons Detail');
        res.status(500).send(error);
        next('router')
    }
    
})

personRouter.get('/find?:id', async( req,res)=> { 
    // get single person detail
    try { 
        personId = req.query.id
        log.verbose(`PersonId:${personId}`)
        person = await db.one({ 
            name: 'get person detail',
            text:`
            select 
            persons.id, persons.name, persons.gender,
            persons.icno, persons.address, persons.contactNo as contact,
            persontypes.personTypeName as type,
            photos.photoid, photos.photopath, photos.faceid
            from persons
            inner join persontypes on persons.persontypeid = persontypes.persontypeid
            inner join photospersons on persons.id = photospersons.personid
            inner join photos on photos.photoid = photospersons.photoid 
            where persons.id = $1`,
            values : [personId]
        })
        res.send(person);
    }catch(error){
        log.error(error);
        res.status(500).json({})
    }
})

personRouter.get('/get-image?:photopath', async( req,res)=>{ 
    // get signed link of the person image 
    try { 
        photopath = req.query.photopath;
        log.verbose(`photoPath:${photopath}`);
        signedUrl = await getUrlS3Obj(BUCKETNAME, photopath, 3600 );
        res.status(200).json({"signedUrl" : signedUrl});
    }catch(error){
        log.error(error);
        res.status(500).send("Error getting signed URL");
    }
})

personRouter.post('/create/resident',(req,res,next)=>{
    // create a person
    // create a resident 
})

personRouter.post('/create/visitor',(req,res,next)=>{
    // create a person 
    // create a visitor
})

personRouter.post('/create/family',(req,res,next)=>{
    // create a person 
    // create a visitor 
})

personRouter.post('/upload/s3/pic',(req,res,next)=>{
    // uplaod picture into s3 bucket 
})

personRouter.post('/create/photo',(req,res,next)=>{
    // create new photo in database 
})

module.exports = personRouter;