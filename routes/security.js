const express = require('express');
const multer = require('multer');
const db = require('../db');
const securityRouter  = express.Router();
const fileUpload = multer();
const { v4 : uuidv4} = require('uuid');
const { one } = require('../db');
const { deleteS3Obj, BUCKETNAME, uploadToBucket, getUrlS3Obj } = require('../modules/s3-bucket');
const { restart } = require('nodemon');
securityRouter.use(express.urlencoded({ extended: true }));

securityRouter.get('/',async(req,res)=>{ 
	try{
		let security = await db.any({
			name: 'get the list of security',
			text: 'SELECT * FROM SECURITYOFFICERS',
		})
		res.status(200).send(security);
	}catch(err){
		res.status(400)
	}
})

securityRouter.post('/',async(req,res)=>{
	console.log("create new security");
	let securityname = req.body['securityname']
	let gender = req.body['gender']
	let contact = req.body['contact']
	let username = req.body['username']
	let password = req.body['password']
	let officertype = req.body['officertype']
	try { 
		let id = await db.one({
			name: "create new security officer",
			text: `INSERT INTO securityofficers
			(securityname, gender, contact, username, password, officertype)
			VALUES($1, $2, $3, $4, $5, $6) RETURNING id`,
			values: [securityname, gender, contact, username, password, officertype]
		})
		res.status(200).json({id: id});
	}catch(err){
		res.status(400)
		return;
	}
})

securityRouter.patch('/:id/update', async(req,res)=>{
	let id = req.params.id;
	let securityname = req.body['securityname'];
	let gender = req.body['gender'];
	let contact = req.body['contact'];
	let officertype = req.body['officertype'];
	try { 
		let resp = await db.none({
			name: 'update security name',
			text: `UPDATE securityofficers SET 
			securityname  = $1,
			gender = $2, 
			contact = $3,
			officertype = $4
			WHERE id = $5`,
			values: [securityname, gender, contact, officertype, id]
		})
		res.status(200).json({valid:true});
	}catch(err){
		console.log(err)
		res.status(400)
	}
})


securityRouter.patch('/:securityid/image',fileUpload.single('profilepic'),async(req,res)=>{
	let uuid = uuidv4();
	let securityid = req.params.securityid;
	let file = req.file
	let path
	let response ;
	try { 
		// look for the orignal photopath
		response = await db.one({
			name: 'Check if path exists for image purpose',
			text: `SELECT * FROM securityofficers 
			WHERE id = $1`,
			values : [securityid] 
		})
		// delete the orignal image from s3 first 
		if (response.photokey !== null){
			console.log('photokey',response.photokey);
			await deleteS3Obj(BUCKETNAME,response.photokey)
		}
		if(file.mimetype === 'image/jpeg' ){
			path = `${uuid}.jpg`;
		}else if(file.mimetype ==='image/png'){ 
			path = `${uuid}.png` ;
		}
		let resp1 = await uploadToBucket(path,BUCKETNAME,file.buffer)
		let resp2 = await db.none({
			name: 'Insert the photokey into database row',
			text: `UPDATE securityofficers SET 
			photokey = $1
			WHERE id = $2 `,
			values: [ path , securityid]
		})
		res.status(200).json({valid:true});
	}catch(err){
		res.status(400).json({valid:false});
	}
})

securityRouter.delete('/:securityid',async(req,res)=>{
	let securityid = req.params.securityid;
	try { 
		// look for the orignal photopath
		let response = await db.one({
			name: 'Check if path exists',
			text: `SELECT * FROM securityofficers 
			WHERE id = $1`,
			values : [securityid] 
		})
		// delete the orignal image from s3 first 
		if (response.photokey !== null){
			console.log('photokey',response.photokey);
			await deleteS3Obj(BUCKETNAME,response.photokey)
		}
		// after delete the s3Obj delete the row in database
		let response2 = await db.none({
			name: 'Delete the securitystaff from the table',
			text: `DELETE FROM securityofficers WHERE id = $1`,
			values: [securityid]
		})
		res.status(200).json({valid:true});
	}catch(err){
		res.status(400).json({valid:false});
	}

})

securityRouter.get('/:id/image',async ( req,res)=>{
	let securityid = req.params.id;
	let url;

	let response = await db.one({
		name: 'Check if path exists',
		text: `SELECT * FROM securityofficers 
		WHERE id = $1`,
		values : [securityid] 
	})

	if (response.photokey !== null){
		console.log('photokey',response.photokey);
		url = await getUrlS3Obj(BUCKETNAME,response.photokey);
	}

	res.status(200).json({url: url});
})


module.exports = securityRouter;

