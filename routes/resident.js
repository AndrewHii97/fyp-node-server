const express = require('express');
const multer = require('multer');
const { restart } = require('nodemon');
const { errors } = require('pg-promise');
const db = require('../db');
const residentRouter  = express.Router();
const fileUpload = multer();
const { v4 : uuidv4} = require('uuid');

const { searchFacesWithId, indexFaces2Collection, deleteIndexedFaces, createByteImage, COLLECTION} = require('../modules/rekog');
const { uploadToBucket, deleteS3Obj , BUCKETNAME } = require('../modules/s3-bucket');

residentRouter.use(express.urlencoded({ extended: true }));

residentRouter.get('',async(req,res)=>{
    let approved = req.query.approved;
    try{ 
        let resident = await db.any({
            name: 'get the list of residents information',
            text: `select 
            persons.id, persons.gender, persons.icno, persons.address, persons.name, 
            residents.username, residents.contact, 
            livingunits.unitcode, residents.livingunitid
            from persons inner join residents on persons.id = residents.id
            left join livingunits on residents.livingunitid = livingunits.livingunitid 
            where residents.approved = $1`,
            values: [approved]
        })
        res.status(200).json(resident);
    }catch(err){ 
        console.log(err);
        res.status(200).json([]);
    }
})

residentRouter.post('',async(req,res)=>{ 
    let name = req.body.name;
    let gender = req.body.gender;
    let icno = req.body.icno;
    let address = req.body.address;
    let contact = req.body.contact;
    let password = req.body.password;
    let livingunitid = req.body.livingunitid;
    let username = req.body.username;
    let keyid = req.body.keyid;
    console.log(typeof keyid, keyid)
    // livingunitid can be empty 
    try{ 
        // create a person
        let result = await db.one({ 
            name: 'create new person',
            text: `INSERT INTO Persons(gender, icno, address, 
                persontypeid, name)
            VALUES($1,$2,$3,$4,$5)
            RETURNING id`,
            values: [gender,icno,address,1,name]
        })
        console.log(result);
        // use the person id to create a resident 
        let response = await db.none({ 
            name: 'create resident with person assigned to',
            text: `INSERT INTO Residents(id, username, password,
                 livingunitid, contact, approved)
            VALUES($1, $2, $3, $4, $5, $6)`,
            values: [result.id, username, password, livingunitid, contact, true]
    
        })
        // link the key with the person
        if (keyid !== 'undefined'){
            await db.none({
                name: 'link the person with key',
                text: `INSERT INTO PersonsKeys(personid, keyid)
                VALUES ($1, $2)`,
                valuse: [result.id, keyid]
            })
        }
        // response no error 
        res.status(200).json({valid: true, id : result.id});
    }catch(err){
        console.log(err);;
        res.status(400).json({message: err});
    }
})

residentRouter.post('/image/check',fileUpload.single('checkImage'),async(req,res)=>{
    let file = req.file
    let byteImage = createByteImage(file.buffer);
    let indexedFacesLength;
    let unindexedFacesLength;

    try { 
        // response IndexFaceCommandOutput
        // only index a single face the rest is unindexed
        let response   = await indexFaces2Collection('faces',byteImage, null, null, 1 , 'HIGH');
        let responseStr = JSON.stringify(response, null , 2);
        // console.log(responseStr);

        indexedFacesLength = response.FaceRecords.length;
        unindexedFacesLength = response.UnindexedFaces.length;

        if( indexedFacesLength > 0 && unindexedFacesLength > 0){
            console.log('more than 1 faces in pictures');
            res.status(200).json({
                valid: false,
                error: 1,
                message: "more than 1 faces in picture"
            })
            
        }else if ( indexedFacesLength == 0 && unindexedFacesLength > 0){ 
            console.log('unclear or low quality pictures');
            res.status(200).json({
                valid: false,
                error: 2,
                message: "low quality picture"
            })
        }else if ( indexedFacesLength == 0 && unindexedFacesLength == 0){
            console.log('no faces detected in the pictures');
            res.status(200).json({
                valid: false,
                error: 3,
                message: "pictures does not contain face"
            })
        }else if ( indexedFacesLength > 0 && unindexedFacesLength == 0) {
            console.log('single face detected & check for similar faces in collection')
            let searchResponse = await searchFacesWithId('faces',response.FaceRecords[0].Face.FaceId);
            if (searchResponse.FaceMatches.length > 0){
                console.log("similar faces exists in the collection")
                res.status(200).json({
                    valid: false,
                    error: 4,
                    message: "similar faces exists in the collection"
                })
            }else{
                res.status(200).json({
                    valid: true
                })
            }
        }

        // remove the face indexed in the collection if any face is indexed 
        if (response.FaceRecords.length > 0){
            let deleteResponse = await deleteIndexedFaces('faces',[response.FaceRecords[0].Face.FaceId]);
        }
    }catch(err){ 
        res.status(400).json({valid: false});
    }
})


residentRouter.post('/image',fileUpload.single('image'), async(req,res,next)=>{
    let uuid = uuidv4() 
    let file = req.file; 
    let id = req.body.id; // need to be used to update db 
    let faceid;
    let path; // nedd to be used to update db 
    
    if(file.mimetype === 'image/jpeg' ){
        path = `${uuid}.jpg`;
    }else if(file.mimetype ==='image/png'){ 
        path = `${uuid}.png` ;
    }

    
    // index into collection
    try{ 
        let byteImage = createByteImage(file.buffer);
        let response = await indexFaces2Collection(COLLECTION, byteImage, null, null, 1);
        faceid = response.FaceRecords[0].Face.FaceId; // need to used in db 
        let indexedFacesLength ;
        let unindexedFacesLength ;
        indexedFacesLength = response.FaceRecords.length;
        unindexedFacesLength = response.UnindexedFaces.length;

        if( indexedFacesLength > 0 && unindexedFacesLength > 0){
            console.log('more than 1 faces in pictures');
            res.status(200).json({
                valid: false,
                error: 1,
                message: "more than 1 faces in picture"
            })
            await deleteIndexedFaces(COLLECTION, [faceid] )
            next()
            
        }else if ( indexedFacesLength == 0 && unindexedFacesLength > 0){ 
            console.log('unclear or low quality pictures');
            res.status(200).json({
                valid: false,
                error: 2,
                message: "low quality picture"
            })
            next()
        }else if ( indexedFacesLength == 0 && unindexedFacesLength == 0){
            console.log('no faces detected in the pictures');
            res.status(200).json({
                valid: false,
                error: 3,
                message: "pictures does not contain face"
            })
            next()
        }else if ( indexedFacesLength > 0 && unindexedFacesLength == 0) {
            console.log('single face detected & check for similar faces in collection')
            let searchResponse = await searchFacesWithId('faces',response.FaceRecords[0].Face.FaceId);
            if (searchResponse.FaceMatches.length > 0){
                console.log("similar faces exists in the collection")
                res.status(200).json({
                    valid: false,
                    error: 4,
                    message: "similar faces exists in the collection"
                })
                await deleteIndexedFaces(COLLECTION, [faceid] )
                next()
            }
        }
    }catch(err){
        console.log(err);
        next();

    }

    // upload to s3 bucket 
    try{
        let r = await uploadToBucket( path,BUCKETNAME, file.buffer)
    }catch(err){ 
        console.log("problem upload to bucket")
        console.log(err)
        res.status(400).json({valid: false});
        next()
    }

    // update database as final step 
    try{ 
        let dbresp = await db.one({
            name: 'relate the photo to person',
            text: `INSERT INTO photos( photopath, faceid, phototype)
            VALUES( $1, $2, $3) RETURNING photoid`,
            values: [path, faceid, "face"]
        }) 
        let photoid = dbresp.photoid ;
        console.log('photoid', photoid);
        await db.none({
            name: 'relate photo and person in photospersons',
            text: `INSERT INTO photospersons(photoid, personid)
            VALUES ($1, $2)`,
            values: [photoid, id]
        })
        res.status(200).json({valid: true});
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
    }

    
    
})

residentRouter.delete('/:id',async(req,res)=>{ 
    let residentid = req.params.id;
    console.log('delete residentid', residentid);
    let response;
    try{
        await db.any({
            name: 'Delete the resident itself' ,
            text: `DELETE FROM Residents WHERE Residents.id = $1`,
            values: [residentid]
        })

        await db.any({
            name: 'Delete the key ownage ',
            text: `DELETE FROM PERSONSKEYS WHERE PersonsKeys.personid = $1`,
            values: [residentid]
        })

        await db.none({
            name: 'Delete the entries record',
            text: `DELETE FROM ENTRIES WHERE Entries.personid = $1`,
            values: [residentid]
        })


        response = await db.any({
            name: 'Select the photos to know which photos to delete',
            text: `SELECT photos.photoid, photos.photopath, photos.faceid 
            FROM photospersons inner join photos on photos.photoid = photospersons.photoid 
            WHERE photos.phototype=$1 AND photospersons.personid=$2 `,
            values : ['face', residentid]
        })
        await db.none({
            name: 'Delete the linkage of photos & persons on personsphotos',
            text: `DELETE FROM photospersons WHERE photospersons.personid = $1`,
            values: [residentid]
        })

        if ( response.length > 0) { 
            let photoid = response[0].photoid
            let photopath = response[0].photopath
            let faceid = response[0].faceid

            if ( photopath ){ 
                await deleteS3Obj(BUCKETNAME, photopath)
            }

            if ( faceid ){ 
                await deleteIndexedFaces(COLLECTION, [faceid])
            }
            

            await db.any({ 
                name: 'Delete the pictures of the person',
                text: 'DELETE FROM photos WHERE photos.photoid = $1',
                values: [photoid]})
        }

        await db.none({
            name: 'Delete the person itself',
            text: 'DELETE FROM persons WHERE id = $1',
            values: [residentid]
        })

        res.status(200).json({valid: true});

    }catch(err){
        console.log(err)
        res.status(400).json({valid: false});
    }

})

residentRouter.get("/key",async(req,res)=>{
    let id = req.query.id;
    let key;
    // id of the residents 

    // find the key the resident have 
    try{ 
        key = await db.oneOrNone({
            name: 'Get key owned by the residents',
            text: `SELECT keys.keyid, keys.keyvalue, keys.livingunitid FROM keys INNER JOIN personskeys 
            ON personskeys.keyid = keys.keyid
            WHERE personskeys.personid = $1`,
            values: [id]
        })
        res.status(200).send(key);
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
    }
    
})

residentRouter.patch("/:id",async (req, res, next)=>{ 
    let id = req.params.id;  // resident id 
    let name = req.body.name; 
    let gender = req.body.gender;
    let address = req.body.address;
    let contact = req.body.contact;
    let icno = req.body.icno;
    let livingunitid = req.body.livingunitid;
    let keyid = req.body.keyid;

    try{
        await db.none({
            name: 'Update the person Informtion',
            text: `UPDATE Persons 
            SET name = $1,
            gender = $2,
            icno = $3,
            address = $4
            WHERE id = $5`,
            values : [name, gender,icno,address,id]
        })
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
        next();
    }

    try{
        await db.none({
            name: 'Update the resident information',
            text: `UPDATE Residents
            SET livingunitid = $1,
            contact = $2
            WHERE id = $3`,
            values : [livingunitid, contact, id]
        })
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
        next();
    }

    // reassign or delete both require the original key to be removed first 
    try{
        await db.none({
            name: 'Remove the initaially assigned key',
            text: `DELETE FROM personskeys 
            WHERE personid = $1`,
            values : [id]
        })
    }catch(error){
        console.log(err);
        res.status(400).json({valid: false});
        next();
    }

    // the reassgined key is not undefined
    if ( keyid !== 'undefined'){
        try{
            await db.none({
                name: 'Assign a key to the person',
                text: `INSERT INTO personskeys(personid, keyid)
                VALUES($1, $2)`,
                values: [id, keyid]
            })
        }catch(err){
            console.log(err);
            res.status(400).json({valid: false});
            next();
        }
    }

    res.status(200).json({valid: true});
})


module.exports = residentRouter;
