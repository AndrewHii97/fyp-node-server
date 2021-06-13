const cors = require('cors');
const express = require("express");
const db = require('../db'); 
 const multer = require('multer');
const entryRouter = express.Router();
const log = require('npmlog');
const { BUCKETNAME, getUrlS3Obj, deleteS3Obj} = require('../modules/s3-bucket');
const { request } = require('express');

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
            pphotos.photoid as personphotoid, pphotos.photopath as personphotopath
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

entryRouter.get('/:photopath/image',async (req,res)=>{
    let photopath = req.params.photopath;
    console.log(photopath);
    let imageurl = await getUrlS3Obj(BUCKETNAME, photopath, 3600);
    res.status(200).json({imageurl: imageurl});
    
})

entryRouter.get('/:personid/person',async (req,res)=>{
    let personid = req.params.personid;
    let person
    try{ 
        person = await db.one({
            name: 'Get the information and photo of person',
            text: `SELECT persons.id, persons.icno, persons.address, persons.name, photos.photopath, photos.faceid
            FROM persons inner join photospersons on persons.id = photospersons.personid 
            inner join photos on photospersons.photoid = photos.photoid 
            WHERE photos.phototype = 'face' AND persons.id = $1;`,
            values: [personid]
        })
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
    }
    
    let link 
    try{ 
       link = await getUrlS3Obj(BUCKETNAME,person.photopath);
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false});
    }
    let personWithLink = {
        ...person,
        imageurl: link
    }
    res.status(200).json(personWithLink);
})

entryRouter.delete('/:entryid', async(req,res)=>{
    let entryid = req.params.entryid;
    let photopath = req.query.photopath;
    let photoid = req.query.photoid;   
    console.log(entryid, photopath, photoid);
    try{
       let r = await db.none({
           name: 'delete the entry in entries table',
           text: 'DELETE FROM entries WHERE entryid = $1',
           values: [entryid]
       })
    }catch(err){
        console.log(err);
        res.status(400)
        return 
    }

    try{
        let r1 = await db.none({
            name: 'delete photo in photos table related to the entries',
            text: 'DELETE FROM photos WHERE photoid = $1',
            values: [photoid]
        })
    }catch(err){
        console.log(err);
        res.status(400)
        return
    }

    try{
        let r2 = await  deleteS3Obj(BUCKETNAME, photopath);
    }catch(err){
        console.log(err)
        res.status(400)
    }

    res.status(200).json({valid: true});
})



module.exports = entryRouter