const express = require('express');
const db = require('../db');
const houseRouter  = express.Router();

houseRouter.use(express.urlencoded({ extended: true }))

// get full list of house 
houseRouter.get('/list', async (req,res)=>{ 
    let houses; 
    try {
        houses = await db.any({
            name: "get house list",
            text: `SELECT * FROM livingunits`
        })
        res.send(houses);
    }catch (err ){ 
        console.log(err)
        res.status(500);
    }
})

// insert new house
houseRouter.post('/new',async( req, res)=>{ 
    try{ 
        let house = { 
            ownername : req.body.ownername,
            unitcode : req.body.unitcode
        };
        await db.none({
            name: 'create new house entry',
            text: `INSERT INTO livingunits(ownername, unitcode)
            VALUES($1, $2)`,
            values: [house.ownername, house.unitcode]
        })
        res.status(200).json({valid: true});
    }catch(err){
        console.log(err);
        res.json({valid: false});
    }
})

// update existing house
houseRouter.post('/update', async( req, res)=>{ 
    let id = req.body.livingunitid;
    let name = req.body.ownername;
    let unitcode = req.body.unitcode;
    try { 
        let response = await db.none({
            name: "update livingunits",
            text: `UPDATE livingunits
            SET ownername = $1, 
                unitcode = $2 
            WHERE livingunitid = $3 `,
            values: [name, unitcode, id]
        })
        res.status(200).json({valid: true});
    }catch(err){ 
        console.log(err)
        res.json({valid: false});
    }
    
})

houseRouter.post('/delete',async( req,res ) =>{ 
    let id = req.body.livingunitid;
    try { 
        let response = await db.one({
            name : 'check any person is assigned to the house',
            text : `SELECT COUNT(*) FROM livingunits INNER JOIN residents 
            ON livingunits.livingunitid = residents.livingunitid WHERE 
            livingunits.livingunitid = $1`,
            values: [id]
        })
        // someone is still assigned to the unit 
        if (response.count > 0){
            res.status(200).json({valid: false, message: 'owned'});
            return;
        }
    }catch(err){
        console.log(err);
        res.status(400).json({valid: false})
        return;
    }
    // delete the house with its key all together
    try{ 
        let response = await db.none({
            name : 'delete all the keys assigned to the house',
            text : 'DELETE FROM keys WHERE livingunitid = $1',
            values: [id]
        })
    }catch(err){
        res.status(400).json({valid: false});
        return;
    }

    try{
        let response = await db.none({
            name : 'delete the housing unit itself',
            text : `DELETE FROM livingunits WHERE livingunitid = $1`,
            values: [id]
        })
        res.status(200).json({valid: true});
    }catch(err){
        res.status(400).json({valid: false});
        return;
    }

})


module.exports =  houseRouter;
