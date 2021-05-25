const cors = require('cors');
const express = require("express");
const db = require('../db');
const multer = require('multer');
const alertRouter = express.Router();
const log = require('npmlog');
const { BUCKETNAME } = require('../modules/s3-bucket');

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
            inner join photos on photos.photoid = issuesphotos.photoid`
        });
        res.status(200).send(alertList); // send array of alert in json
    }catch(error){ 
        log.error(error);
        res.status(500).send("Fail to get List");
    }
});

alertRouter.get('/personInAlert?:alertid',async (req,res)=>{
    try{ 
        alertid = req.query.alertid;
        log.verbose(`PersonInAlert/IssueId:${alertid}`);
        persons = await db.any({ 
            name: "Person detected in the alert",
            text: `select persons.id, 
            persons.name, photospersons.photoid, 
            pphotos.photopath
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
        console.log(persons);
        persons.forEach(person => {
            
        });
        res.status(200).send(persons);
    }catch(error){
        log.error(error);
        res.status(500).send("Failed to get the person in alerts");
    }
});


module.exports = alertRouter;
