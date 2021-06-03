const express = require('express');
const db = require('../db');
const keyRouter  = express.Router();

keyRouter.use(express.urlencoded({ extended: true }))

keyRouter.get('/list',async(req,res)=>{ 
    try{ 
        let keylist =  await db.any({
            name: "get the list of key",
            text:`SELECT keys.keyid,
            keys.keyvalue, 
            keys.livingunitid, 
            livingunits.unitcode
            FROM keys LEFT JOIN livingunits 
            ON keys.livingunitid = livingunits.livingunitid`
        })
        res.send(keylist);
    }catch(err){
        console.log(err);
        res.send([]);    
    }
})

keyRouter.post('/new',async(req,res)=>{ 
    let keyvalue = req.body.keyvalue;
    let livingunitid = req.body.livingunitid;
    let sql;
    let values;
    // check if livingunitid is determined 
    if (livingunitid === 'undefined'){
        sql = `INSERT INTO keys(keyvalue)
            VALUES($1)`;
        values = [ keyvalue ];
    }else{ 
        sql = `INSERT INTO keys(keyvalue,livingunitid)
            VALUES($1,$2)`;
        values = [ keyvalue, livingunitid];
    }

    try{ 
        let response = await db.none({
            name: 'create new key',
            text: sql,
            values: values
        })
        res.status(200).json({valid:true});
    }catch(err){
        console.log(err);
        res.json({valid:false});
    }
})

keyRouter.delete('/:id',async(req, res)=>{
    let id = req.params.id
    try { 
        let result = await db.none({
        name: "delete key",
        text:
            `DELETE FROM keys
            WHERE keyid = $1`,
        values: [id] 
        })
        res.status(200).json({valid: true});
    }catch(err){
        console.log(err);
        res.json({valid:false});
    }
})

keyRouter.patch('/', async(req,res)=>{
    let keyid = req.body.keyid;
    let keyvalue = req.body.keyvalue;
    let livingunitid = req.body.livingunitid;
    let sql;
    let values;
    if (livingunitid === 'undefined'){
        sql = `UPDATE keys
          SET keyvalue = $1,
          livingunitid = NULL
          WHERE keyid = $2`;
        values = [keyvalue, keyid];
    }else{ 
        sql = `UPDATE keys
          SET keyvalue =$1,
          livingunitid =$2
          WHERE keyid  =$3` ;
        values = [keyvalue, livingunitid, keyid];
    }
    console.log(sql);
    try{
        db.none({
            name: "update the exisiting key value",
            text: sql,
            values: values
        })
        res.status(200).json({valid: true});
    }catch(err){
        console.log(err)
        res.status(200).json({valid: false});
    }
    

})


module.exports = keyRouter;