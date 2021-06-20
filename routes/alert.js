const cors = require('cors');
const express = require("express");
const db = require('../db');
const multer = require('multer');
const alertRouter = express.Router();
const log = require('npmlog');
const { BUCKETNAME, getUrlS3Obj, deleteS3Obj} = require('../modules/s3-bucket');
const { dangerouslyDisableDefaultSrc } = require('helmet/dist/middlewares/content-security-policy');

log.level = 'all';
log.heading = 'alert'

alertRouter.use(cors())

alertRouter.get('/alertList',async ( req,res)=>{ 
    try{ 
        alertList = await db.any({
            name: "List All Alert", 
            text: `select issues.issueid as alertid, TO_CHAR(issues.issuedate :: DATE, 'dd/mm/yyyy') as alertdate,
            TO_CHAR(issues.issuetime :: TIME, 'HH24:MI:SS') as alerttime, issues.description as description, 
            photos.photoid, photos.photopath
            from issues
            inner join issuesphotos on issues.issueid = issuesphotos.issueid
            inner join photos on photos.photoid = issuesphotos.photoid
            where issues.checked=$1`,
            values: ['true']
        });
        res.status(200).send(alertList); // send array of alert in json
    }catch(error){ 
        log.error(error);
        res.status(500).send("Fail to get List");
    }
});

alertRouter.get('/alertListPending',async ( req,res)=>{ 
    try{ 
        alertList = await db.any({
            name: "List All Pending Alert", 
            text: `select issues.issueid as alertid, TO_CHAR(issues.issuedate :: DATE, 'dd/mm/yyyy') as alertdate,
            TO_CHAR(issues.issuetime :: TIME, 'HH24:MI:SS') as alerttime, issues.description as description, 
            photos.photoid, photos.photopath
            from issues
            inner join issuesphotos on issues.issueid = issuesphotos.issueid
            inner join photos on photos.photoid = issuesphotos.photoid
            WHERE issues.checked=$1`,
            values: ['false']
        });
        res.status(200).send(alertList); // send array of alert in json
    }catch(error){ 
        log.error(error);
        res.status(500).send("Fail to get List");
    }
});

alertRouter.delete('/:alertid/:photoid',async(req, res)=>{
    let alertid = req.params.alertid;
    let photoid = req.params.photoid
    console.log('alertid',alertid);
    console.log('photoid',photoid);
    // delete the image in s3 required 
    let r1 = await db.none({
        name:' delete issues from issuephoto',
        text:'DELETE FROM issuesphotos WHERE issueid = $1',
        values: [alertid]
    })

    let r2 = await db.none({
        name:' delete issues from issues',
        text: 'DELETE FROM issues WHERE issueid = $1',
        values: [alertid]
    })

    let r3 = await db.none({
        name:' delete photo from entries',
        text: 'DELETE FROM entries WHERE photoid = $1',
        values: [photoid]
    })

    let r4 = await db.one({
        name: 'delete photo from photos',
        text: 'DELETE FROM photos WHERE photoid = $1 RETURNING *',
        values: [photoid]
    })

    let s3path = await r4.photopath ;
    let r5 = await deleteS3Obj(BUCKETNAME,s3path);

    res.status(200).json({valid:true});
})

alertRouter.patch('/:id', async(req, res)=>{
    let id = req.params.id;
    try{ 
        let response = await db.none({
            name: 'Update the checked column to true',
            text: 'UPDATE issues SET checked= $1',
            values: [true]
        })
        res.status(200).json({valid:true});
    }catch(err){
        res.status(400).json({valid:false});
    }
})

// get signedUrl of the S3 Object given the photoid 
alertRouter.get('/:id/image', async(req, res)=>{
    let id = req.params.id;
    let imagepath;
    let url;
    try{ 
        let image = await db.oneOrNone({
            name : 'Get the image path given the image id',
            text : `select * from photos where photoid = $1`,
            values : [id]
        })
        console.log('image path', image.photopath);
        imagepath = image.photopath;
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
        return
    }

    try{ 
        url = await getUrlS3Obj(BUCKETNAME, imagepath, 3600);
        res.status(200).json({imageurl: url});
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
    }
})

alertRouter.get('/personInAlert',async (req,res)=>{
    let personsWithUrl = []; 
    try{ 
        alertid = req.query.alertid;
        log.verbose(`PersonInAlert/IssueId:${alertid}`);
        persons = await db.any({ 
            name: "Person detected in the alert",
            text: `select persons.id, 
            persons.name, photospersons.photoid, 
            pphotos.photopath,
            pphotos.faceid
            from issues 
            inner join issuesphotos on issuesphotos.issueid = issues.issueid 
            inner join photos on issuesphotos.photoid = photos.photoid
            inner join entries on entries.photoid = photos.photoid
            inner join persons on persons.id = entries.personid 
            inner join photospersons on persons.id = photospersons.personid
            inner join photos as pphotos on pphotos.photoid = photospersons.photoid
            where issues.issueid = $1;`,
            values: [alertid]
        });
        let personsWithUrl = await getListofFaceUrl(persons);
        res.status(200).send(personsWithUrl);
    }catch(error){
        log.error(error);
        res.status(500).send("Failed to get the person in alerts");
    }
});

async function getListofFaceUrl(list){
    let url
    let newArray = []
    for(let i = 0 ; i < list.length; i++){ 
       url = await getUrlS3Obj(BUCKETNAME, list[i].photopath, 3600);
       newArray.push({
           ...list[i],
           imageurl : url
       })
    }
    return newArray
}

alertRouter.get('/unchecked/total', async (req,res)=>{
    try{ 
        let response = await db.one({
            name: 'get total unchecked alert',
            text: `SELECT COUNT(checked) FROM ISSUES WHERE checked=$1`,
            values:['false']
        })
        console.log(response);
        res.status(200).json({...response});
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
        
    }
})

alertRouter.get('/latest',async(req,res)=>{
    let response;
    try{
        response = await db.oneOrNone({
            name: 'get the latest alert information',
            text: `SELECT issues.issueid as alertid, TO_CHAR(issues.issuedate :: DATE, 'dd/mm/yyyy') as alertdate,
            TO_CHAR(issues.issuetime :: TIME, 'HH24:MI:SS') as alerttime, issues.description as description, 
            photos.photoid, photos.photopath 
            FROM issues 
            inner join issuesphotos on issues.issueid = issuesphotos.issueid
            inner join photos on photos.photoid = issuesphotos.photoid
            ORDER BY alertdate DESC, alerttime DESC
            LIMIT 1;`
        })
        res.status(200).json({...response});
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
    }
})


module.exports = alertRouter;
