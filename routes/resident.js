const express = require('express');
const multer = require('multer');
const db = require('../db');
const residentRouter  = express.Router();
const fileUpload = multer();
const { v4 : uuidv4} = require('uuid');

const { searchFacesWithId, indexFaces2Collection, deleteIndexedFaces, createByteImage, COLLECTION, createS3Image} = require('../modules/rekog');
const { getUrlS3Obj, uploadToBucket, deleteS3Obj , BUCKETNAME } = require('../modules/s3-bucket');

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

residentRouter.get('/image',async (req,res)=>{
    let id = req.query.id;
    let photos;
    console.log('id',id);
    try{
        photos = await db.oneOrNone({
            name:'get the image of this resident',
            text:`SELECT photos.photoid, photos.photopath, photos.faceid from
            (persons inner join photospersons on 
            persons.id = photospersons.personid inner join photos 
            on photos.photoid = photospersons.photoid )
            where photos.phototype='face' AND photospersons.personid = $1`,
            values: [id]
        })
        let s3path = photos?.photopath;
        if ( s3path ){
            console.log('photokey',s3path);
            let imageUrl =  await getUrlS3Obj(BUCKETNAME, s3path, 3600);
            res.status(200).json({ ...photos, imageUrl: imageUrl});
        }else{ 
            res.status(200).json({ valid: false});
        }
    }catch(err){ 
        console.log(err)
        res.status(400).json({valid: false});
    }
})

residentRouter.get('/:residentid', async(req,res)=>{
    let residentId = req.params.residentid;
    if( residentId == 'undefined'){
        res.status(200)
        return;
    }
    try { 
        let response = await db.oneOrNone({ 
            name: 'Get the resident information with id',
            text: `select persons.id, persons.gender, persons.icno, persons.address, persons.name,
            residents.username, residents.contact, residents.approved, residents.livingunitid,
            livingunits.unitcode
            from persons inner join residents on persons.id = residents.id  
            inner join livingunits on livingunits.livingunitid = residents.livingunitid
            where residents.id = $1`,
            values: [residentId]
        })
        if(response){
            res.status(200).json({...response});
        }
    }catch(err){
        res.status(400);
    }
})


residentRouter.post('/id', async(req, res)=>{ 
    let username = req.body.username;
    let password = req.body.password;
    try{ 
        let response = await db.oneOrNone({
            name: 'Check if resident exists and is approved',
            text: `select persons.id, residents.approved 
            from persons inner join residents on persons.id = residents.id 
            where residents.username = $1 and residents.password = $2`,
            values: [username, password]
        })
        if(response){
            res.status(200).json({...response, valid:true});
        }else{
            res.status(200).json({valid:false});
        }
    }catch(err){
        console.log('error in database query');
        console.log(err);
        res.status(400).json({valid: false});
        return;
    }

})

residentRouter.post('/:residentid/approve', async(req,res)=>{
    let residentid = req.params.residentid;
    // update the resident row to approved to approved
    let update = await db.any({
        name: "Approve the resident column",
        text: `UPDATE residents SET approved = $1
        WHERE id = $2`,
        values: [true, residentid]
    })
    // get the photopath of the resident image 
    let photos = await db.one({
        name: "Get photokey of the residents",
        text: `SELECT photos.photoid,photos.photopath FROM photospersons INNER JOIN
        photos ON photos.photoid = photospersons.photoid
        WHERE photospersons.personid = $1 AND 
        photos.phototype = $2`,
        values: [ residentid, 'face']
    })
    let photokey = photos.photopath;
    let photoid = photos.photoid;
    // make sure the photokey is not null
    let s3object;
    let indexResult;
    if (photokey){
        s3object = createS3Image(BUCKETNAME,photokey);
        try{
            indexResult = await indexFaces2Collection(COLLECTION,s3object)
        }catch(err){
            console.log(err)
        }
    }
    let faceid = indexResult.FaceRecords[0].Face.FaceId;
    let tableUpdate = await db.none({
        name: "update photos with faceid for the approved resident",
        text: `UPDATE photos SET faceid = $1 WHERE
        photoid = $2`,
        values : [faceid, photoid ]
    })

    res.status(200).json({valid : true});
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
    let notapprove = req.body.notapprove;
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
        if(notapprove){
            let response = await db.none({ 
                name: 'create resident with person assigned to',
                text: `INSERT INTO Residents(id, username, password,
                    livingunitid, contact, approved)
                VALUES($1, $2, $3, $4, $5, $6)`,
                values: [result.id, username, password, livingunitid, contact, false]
            })
        }else{
            let response = await db.none({ 
                name: 'create resident with person assigned to',
                text: `INSERT INTO Residents(id, username, password,
                    livingunitid, contact, approved)
                VALUES($1, $2, $3, $4, $5, $6)`,
                values: [result.id, username, password, livingunitid, contact, true]
        
            })
        }
        // link the key with the person
        if (keyid !== 'undefined'){
            await db.none({
                name: 'link the person with key',
                text: `INSERT INTO PersonsKeys(personid, keyid)
                VALUES ($1, $2)`,
                values: [result.id, keyid]
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
            // make sure the faceid is not used already by checking the database 
            let faceid = response.FaceRecords[0].Face.FaceId
            let faceRes = await db.oneOrNone({
                name: "search for similar faceid in database", 
                text: `SELECT * FROM photos where 
                faceid = $1`,
                values: [faceid]
            })

            if(faceRes){
                res.status(200).json({
                    valid: false,
                    error: 5,
                    message: "exact same copy of pictures found"
                })
                return;
            }else{
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

        }

        // remove the face indexed in the collection if any face is indexed 
        if (response.FaceRecords.length > 0){
            let deleteResponse = await deleteIndexedFaces('faces',[response.FaceRecords[0].Face.FaceId]);
        }
    }catch(err){ 
        res.status(400).json({valid: false});
    }
})

residentRouter.post('/image/unapprove',fileUpload.single('image'), async(req,res,next)=>{
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
            text: `INSERT INTO photos( photopath, phototype)
            VALUES( $1, $2) RETURNING photoid`,
            values: [path, "face"]
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

residentRouter.post('/image',fileUpload.single('image'), async(req,res,next)=>{
    let uuid = uuidv4() 
    let file = req.file; 
    let id = req.body.id; // need to be used to update db 
    let notapprove = req.body.notapprove
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
            return;
        }else if ( indexedFacesLength == 0 && unindexedFacesLength > 0){ 
            console.log('unclear or low quality pictures');
            res.status(200).json({
                valid: false,
                error: 2,
                message: "low quality picture"
            })
            return;
        }else if ( indexedFacesLength == 0 && unindexedFacesLength == 0){
            console.log('no faces detected in the pictures');
            res.status(200).json({
                valid: false,
                error: 3,
                message: "pictures does not contain face"
            })
            return;
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
                return;
            }
        }
    }catch(err){
        console.log(err);
        res.status(400).json({
            valid: false
        })
        return
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

residentRouter.patch('/image',fileUpload.single('image'),async(req,res)=>{
    console.log('Patch image')
    let uuid = uuidv4() 
    let file = req.file; 
    let path; // new photopath
    let faceid; // new faceid
    let photopath = req.body.photopath;
    let oldfaceid = req.body.faceid;
    let photoid = req.body.photoid; // need to be used to update db 

    if(file.mimetype === 'image/jpeg' ){
        path = `${uuid}.jpg`;
    }else if(file.mimetype ==='image/png'){ 
        path = `${uuid}.png` ;
    }

    // try to index in face collection
    let byteImage = createByteImage(file.buffer);
    try{
        let indexResponse = await indexFaces2Collection(COLLECTION, byteImage, null, null, 1);
        faceid = indexResponse.FaceRecords[0].Face.FaceId; 
    }catch(err){
        console.log(err)
        res.status(400).json({valid: false});
        return;
    }
    // upload to s3Bucket
    try{
        let r = await uploadToBucket( path,BUCKETNAME, file.buffer)
    }catch(err){
       console.log(err) 
       res.status(400).json({valid: false});
       await deleteIndexedFaces(COLLECTION, [faceid]);
       return;
    }
    let indexRes;
    // if succesful delete the old photo in collection and bucket 
    try{ 
        indexRes = await deleteIndexedFaces(COLLECTION, [oldfaceid]);
        indexRes = deleteS3Obj(BUCKETNAME, photopath);
    }catch(err){
        res.status(400).json({valid: false});

    }
    // now upate the database table  
    try{ 
        let dbresp = await db.none({
            name: 'update the photo information',
            text: `UPDATE photos
            SET photopath = $1,
            faceid = $2
            WHERE photoid = $3`,
            values: [ path, faceid, photoid]
        })
        res.status(200).json({valid: true});
    }catch(err){
        res.status(400).json({valid: false});
    }
})

residentRouter.patch("/:residentid/keyless",async (req,res)=>{
    let id = req.params.residentid;
    let name = req.body.name;
    let gender = req.body.gender;
    let contact = req.body.contact;
    let address = req.body.address;
    let icno = req.body.icno;

    try{
        let rsp = await db.none({
            name: 'update residents inforamtion via mobile apps',
            text: `UPDATE persons 
            SET gender = $1,
            icno = $2,
            address = $3,
            name = $4
            WHERE id = $5` ,
            values: [gender, icno,address,name, id ]
        })
    }catch(err){
        console.log(err)
        res.status(400)
        return;
    }

    try{
        let rsp = await db.none({
            name: 'update the residents information contact via mobile apps',
            text: `UPDATE residents
            SET contact = $1 
            WHERE id = $2`,
            values: [contact, id]
        })
        res.status(200).json({});
    }catch(err){
        console.log(err);
        res.status(400).json({});
        return;
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
        return
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
            return;
        }
    }

    res.status(200).json({valid: true});
})



residentRouter.patch('/image',fileUpload.single('image'),async(req,res)=>{
    console.log('Patch image')
    let uuid = uuidv4() 
    let file = req.file; 
    let path;
    let phototid = req.body.photoid; // need to be used to update db 

    if(file.mimetype === 'image/jpeg' ){
        path = `${uuid}.jpg`;
    }else if(file.mimetype ==='image/png'){ 
        path = `${uuid}.png` ;
    }
    console.log(path);
    console.log(file);

    res.status(200).json({valid: true});

})

// update password for resident profile from resident mobile apps 
residentRouter.patch('/:id/password', async(req,res)=>{
    let id = req.params.id;
    let oriPassword = req.body.oripassword;
    let newPassword = req.body.newpassword; 
    let response;

    try{
        response = await db.oneOrNone({
            name: 'check if the orignal password exists',
            text: `SELECT password FROM residents 
            WHERE id = $1` ,
            values : [id]
        })
        console.log(response);
    }catch(err){
        res.status(400).json({valid: false});
        console.log(err);
        return;
    }
    
    try{
        if (response.password == oriPassword) {
            let result = await db.none({
                name: 'update the password if the password match',
                text: `UPDATE residents SET password = $1 WHERE id = $2`,
                values: [ newPassword, id]
            })
            res.status(200).json({valid: true});
        }else{
            res.status(200).json({valid: false});
        }
    }catch(err){
        res.status(400).json({valid:false});
        console.log(err);
        return;
    }

})


module.exports = residentRouter;
