const express = require('express');
const db = require('../db');
const multer = require('multer');
const morgan = require('morgan')
const deviceRouter = express.Router();
const log = require('npmlog')
log.heading = 'device'
log.level = 'all'
const {
    BUCKETNAME,
    uploadToBucket,
}= require('../modules/s3-bucket');
const { 
    COLLECTION,
    createS3Image,
    createDetectLabelsCommand,
    analyseImage,
    indexFaces2Collection,
    deleteIndexedFaces,
    detectFaces,
    searchFacesWithId
} = require('../modules/rekog')
deviceRouter.use(morgan('dev'))
// use build in body parser from express
deviceRouter.use(express.json());
deviceRouter.use(express.urlencoded({
    extended: true 
}));
upload = multer()
deviceRouter.use(upload.any())

/**
 * Routes: 
 * "/" : "Authenticaton required before able to use the device routes features" 
 * "/rfid-check" : "search RFID in the database & return the key owner "
 * "aws/upload-photo" :
 *      " 1. Upload photo to S3 
 *        2. Update the database on the photo
 *        3. Return Photo Key 
 *      "
 * "aws/count-person" : 
 *      " 1. The key of photo is provided 
 *        2. Count the number of person in the images specified by the photo key
 *        3. Return the person count  
 *      "
 * "aws/count-faces" : 
 *      " 1. The key of photo is provided 
 *        2. Count the number of faces in the images specified by the photo key 
 *        3. Return the number of faces detected 
 *      "
 * "aws/search-faces" : 
 *     "1. search faces with image from s3 in rekognition index collection
 *      2. the image from s3 have to indexed first
 *      3. the index is used to search the similar faces in rekognition 
 *      4. the faceid of the faces found is returned
 *      5. the faceid is used to search for person id and name in database 
 *      6. the faceid of the initial indexed photos is deleted at the end of
 *      process 
 *      7. the list of person and its information is returned to the devices
 *     "
 * "/add-image" : 
 *      "1. add new photo information into database"
 * "/photo-path" : 
 *      "1. given photoid return photopath" 
 * "/create-entry"
 *      "1. create entry of residents/visitors/family" 
 * "/create-issues"
 *      "1. create issues related to be view by security and officer"
 *      "2. issues include tailgating, intruders, unclear condition "
 *      "3. issues need to relate to the issues photo "
 * "/search/faceindex/person"
 *      "1. search with faceindex and return person information"
 */
deviceRouter.use('/',async (req,res,next)=>{
    log.info('AUTH','Performing Authentication for devices')
    let deviceName = req.body.device_name; // device_name 
    let password = req.body.password; // device password  
    try{ 
        data = await db.one({
            name: 'authenticate-device',
            text: 'SELECT * FROM Devices WHERE deviceName = $1 AND devicepassword = $2',
            values: [deviceName, password]
        })
        log.verbose('AUTH',`DATA: ${data}`);
        req.body.id = data.deviceid;
        next();
    }catch(err){
        log.error('AUTH',err);
        res.status(401).json({"error":"401","message":"authentication fail"})
    }
});

// check rfid key exists if true open the door 
deviceRouter.post('/rfid-check',async (req,res)=>{
    log.info('/rfid-check','Search for RFID key in DB')
    let rfid = req.body.rfid
    // modify to return list of valid key user 
    try{
        keyOwner = await getRfidKeyOwner(rfid);
        log.verbose(`DATA${keyOwner}`);
        log.info(`/rfid-check`,"Return list of keyOwner")
        res.json({
            "status": true, 
            "keyowner": keyOwner 
        });
    }catch(err){ 
        log.error("ERROR",err);
        res.json({
            "status": false, 
            "message": `${rfid} does not exist`
        });
        
    }
})

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

deviceRouter.post('/aws/upload-img',async (req,res,next)=>{
    log.info("/aws/upload-img","Store images to S3 Bucket")
    req.files.forEach( async (file)=>{
        try{ 
            let s3Response = await
            uploadToBucket(file.fieldname,BUCKET_NAME,file.buffer);
            log.verbose("/aws/upload-img",`${s3Response}`);
            res.status(200).send()
        }catch(err){ 
            log.error("ERROR",`${err}`)
            res.send(err)
            next('router')
        }
    })
})

deviceRouter.post('/add-img',async (req,res,next) =>{ 
    log.info("/add-img","Update image in database")
    try{ 
        response =  await insertEntryPhoto(file.fieldname)
        log.verbose("/add-img",response)
        res.status(200).send(response)
    }catch(err){ 
        log.error("/add-img",err)
        res.send(err)
        next('router')
    }
})

async function insertEntryPhoto(fileName){
    // Insert entry photo which does not have any person information
    response = await db.none({
        name: 'insert-photo-table',
        text: 'INSERT INTO photos(photopath) VALUES ($1)',
        values: [fileName]
    })
}

deviceRouter.post('/photo-path',async (req,res)=>{ 
    log.info("/photo-path","Get photo path using photoid.")
    photoid = req.body.photoid
    try { 
        data = await getPhotoPath(photoid)
        res.send(data)
    }catch(err){ // error handling  
        log.error("/photo-path",err)
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

deviceRouter.post('/aws/count-persons',async (req,res)=>{
    log.info("/aws/count-persons","Start process to count person ")
    let fileName =  req.body.fileName
    try{ 
        let image = createS3Image(BUCKETNAME,fileName)
        let command = createDetectLabelsCommand(image)
        let result = await analyseImage(command)
        // search for "Person" label
        log.info("/aws/count-persons","Search for Person label")
        let persons = undefined 
        result.Labels.forEach((label)=>{
            if( label.Name === "Person"){
                console.log("Person Detected")
                persons = label.Instances
            }
        })
        // count and return the Person Instances Count in the label 
        log.info("/aws/count-persons","Count the number of person")
        if (persons === undefined){
            log.verbose("/aws/count/-person","Person not found in the image")
            res.json({
                "PersonCount": 0
            })
        }else{ 
            log.verbose("/aws/count-persons",`PersonCount:${persons.length}`)
            res.json({
                "PersonCount": persons.length
            })
        }
    }catch(err){
        log.error("/aws/count-persons",err)
        res.send(err)
    }
})

deviceRouter.post('/aws/count-faces',async (req,res)=>{
    log.info("/aws/detect-faces","Detect Number of Faces in Image");
    let fileName = req.body.fileName; 
    try { 
        let image = createS3Image(BUCKETNAME,fileName);
        log.verbose("/aws/count-faces",image)
        let response = await detectFaces(image);
        let faces = response.FaceDetails;
        log.verbose("/aws/count-faces",response);
        let faceCount = faces.length
        log.verbose("/aws/count-faces",`FaceCount:${faceCount}`)
        res.json({
            "FaceCount": faceCount
        })
    }catch(err){ 
        log.error("/aws/count-faces",err);
        res.send(err)
    }
})



deviceRouter.post('/aws/search-faces',async(req,res)=>{
    log.info("/aws/search-faces","Search faces in Collection")
    let fileName = req.body.fileName
    log.info("/aws/search-faces",`Search for faces in ${fileName}`)
    let hasUnIndexed = false
    log.verbose("/aws/search-faces",`hasIndexed:${hasUnIndexed}`) 
    try { 
        let image = createS3Image(BUCKETNAME,fileName)
        log.info("/aws/search-faces","Index faces into Collection")
        let response = await indexFaces2Collection(COLLECTION,
            image,["DEFAULT"],fileName)
        log.verbose("/aws/search-faces",`${response}`)
        let faces = response.FaceRecords // array of faces 
        let faceId = [] 
        faces.forEach((f)=> {
            faceId.push(f.Face.FaceId)
        })
        log.verbose("/aws/search-faces",`Face Indexed:\n${faceId}`)
        let unindexedCount = response.UnindexedFaces.length
        if (unindexedCount > 0){ 
            log.warn('/aws/search-faces',`${unindexedCount} Faces Unindexed`)
            hasUnIndexed = True
            log.verbose("/aws/search-faces",`hasIndexed:${hasUnindexed}`)
        }
        let matchedFaces = []
        log.info("/aws/search-faces","Search similar faces with faceID indexed")
        let face = { 
            "searchId": "",
            "FaceMatches": ""
        }
        faceId.forEach(async (id)=>{
            try{
                let searchResult = await searchFacesWithId(COLLECTION,id)
                face = { 
                    "searchId": id,
                    "FaceMatches": searchResult.FaceMatches
                }
                matchedFaces.push(face)
            }catch(err){
                log.error(err)
            }
        })
        log.info("/aws/search-faces","Delete the indexed faces")
        await deleteIndexedFaces(COLLECTION,faceId)
        res.json({
            "hasUnIndexed": hasUnIndexed,
            "Result": matchedFaces,
        })
    }catch(err){ 
        log.error(err)
        res.send(err)
    }
})

// TODO - in progress  
// search with faceIndex then return person
deviceRouter.post("/search/faceindex/person",async(req,res)=>{
    let facesIndex = req.body.FaceIndex
    log.info("/search/faceIndex/person","Searching for Persons with FaceIndex")
    log.verbose("/search/faceINdex/person",facesIndex)
    try{
        persons = await db.any(
            "SELECT persons.id,persons.name,persons.persontypeid, photos.photoid, photos.faceid, photos.photopath FROM " +
            "persons INNER JOIN photospersons ON persons.id = photospersons.personid " +
            "INNER JOIN photos ON photospersons.photoid = photos.photoid " +
            "WHERE photos.faceid IN ($1:csv);",
            [facesIndex])
        log.verbose("/search/faceIndex/person",persons)
        res.send(persons)
    }catch(err){
        log.error(err)
        res.send(err)
    }
})

// "/create-entry"
//      "1. create entry of residents/visitors/family" 
// "/create-issues"
//      "1. create issues related to be view by security and officer"
//      "2. issues include tailgating, intruders, unclear condition "
//      "3. issues need to relate to the issues photo "
// "/search/faceindex/person"
//      "1. search with faceindex and return person information"
module.exports = deviceRouter;

