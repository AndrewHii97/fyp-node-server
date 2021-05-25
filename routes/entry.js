const cors = require('cors');
const express = require("express");
const db = require('../db'); 
 const multer = require('multer');
const entryRouter = express.Router();
const log = require('npmlog');
const { BUCKETNAME } = require('../modules/s3-bucket');

log.level = 'all';
log.heading = 'alert'

entryRouter.use(cors())

entryRouter.get('/entryList',async (__ , res)=>{ 
    try{ 
        entryList = await db.any({
            name: "Get List of Entry",
            text: `select entries.entryid, TO_CHAR(entries.entrydate::DATE,'dd/mm/yyyy') as entrydate,
            TO_CHAR(entries.entrytime::TIME, 'HH24:MI:SS') as entrytime, entries.hasIssue,
            persons.id, persons.name,persontypes.persontypename as type , photos.photoid, photos.photopath,
            pphotos.photoid as personphoto, pphotos.photopath as personphotopath
            from entries inner join 
            persons on persons.id = entries.personid
            inner join photos on photos.photoid = entries.photoid 
            inner join persontypes on persontypes.persontypeid = persons.persontypeid
            inner join photospersons on photospersons.personid = persons.id 
            inner join photos as pphotos on pphotos.photoid = photospersons.photoid 
            where hasissue = 'false'`
        }); 
        console.log(entryList)
        res.status(200).send(entryList);
    }catch(err){
        log.error(err);
        res.status(500).send(err);
    }
})

entryRouter.get('/entryDetail?:entryid',async (req,res)=>{
    entryid = req.query.entryid;
    try{ 
        entryDetail = await db.one({
            name: "Get Entry Detail",
            text: `select entries.entryid, TO_CHAR(entries.entrydate::DATE,'dd/mm/yyyy') as entrydate,
            TO_CHAR(entries.entrytime::TIME, 'HH24:MI:SS') as entrytime, entries.hasIssue,
            persons.id, persons.name,persontypes.persontypename as type, photos.photoid, photos.photopath,
            pphotos.photoid as personphotoid, pphotos.photopath as personphotopath
            from entries inner join 
            persons on persons.id = entries.personid
            inner join photos on photos.photoid = entries.photoid 
            inner join persontypes on persontypes.persontypeid = persons.persontypeid
            inner join photospersons on photospersons.personid = persons.id 
            inner join photos as pphotos on pphotos.photoid = photospersons.photoid 
            where hasissue = 'false' AND entries.entryid = $1;`,
            values: [entryid]
        })
        res.status(200).send(entryDetail);
    }catch(err){
        log.error(err);
        res.status(500).send(err);
    }
})

module.exports = entryRouter