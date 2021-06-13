const express = require('express');
const db = require('../db');
const tokenRouter  = express.Router();

tokenRouter.use(express.urlencoded({ extended: true }))

// create or update the token in database
tokenRouter.patch('',async (req,res)=>{
	let personid = req.body.id // person id 
	let token = req.body.token // token 
	let agent = req.headers['user-agent'];
	let resp ;

	try{ 
		resp = await db.oneOrNone({
			name: "check if the person id and machine already exist",
			text: "SELECT * FROM token WHERE personid = $1 AND agent = $2",
			values: [personid, agent]
		})
	}catch(err){
		res.status(400)
		return;
	}

	try{
		// if the personid & agent pair exists update the row with new token 
		if (resp) { 
			let r = await db.none({ 
				name: 'update the token row',
				text: 'UPDATE token SET token = $1 WHERE personid = $2 AND agent = $3',
				values: [token, personid, agent]
			})
		}else{  // create new row for the id 
			let r1 = await db.none({
				name: 'create new token row',
				text: 'INSERT INTO token(personid,agent,token) VALUES($1,$2,$3)',
				values: [personid, agent, token ]
			})
		}
	}catch(err){
		console.log(err);
		res.status(400);
	}
	res.status(200);
})

module.exports = tokenRouter;
