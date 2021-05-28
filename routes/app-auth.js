const { v4 : uuidv4} = require('uuid');
const express = require('express');
const db = require('../db');
const multer = require('multer');
const fileUpload = multer();
const authRouter = express.Router();


authRouter.use(express.urlencoded({ extended: true }));

authRouter.post('/auth', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    try {
        let data = await db.one({
            name: 'authenticate web app user',
            text: `SELECT ID FROM SECURITYOFFICERS WHERE USERNAME = $1 AND 
                   PASSWORD = $2`,
            values: [username, password]
        });
        res.json({
            "id": data.id,
            "isValid": true
        });
    } catch (err) {
        res.json({
            "isValid": false
        });
    }
});



authRouter.get('/profile/:id', async (req, res) => {
    let id = req.params.id;
    try {
        profile = await db.one({
            name: 'get profile information of user',
            text: `SELECT * FROM SECURITYOFFICERS WHERE ID = $1`,
            values: [id]
        })
        // return json with profile information 
        res.json({
            gender: profile.gender,
            username: profile.username,
            photokey: profile.photokey,
            officertype: profile.officertype,
            name: profile.securityname,
            age: profile.age,
            contact: profile.contact
        })
    } catch (err) {
        res.status(500).json({ message: err });
    }
})

authRouter.post('/profile/:id/update', async (req, res) => {
    let response;
    let id = req.params.id;
    try { 
        response = await db.none({
            name: "Update profile information",
            text: 
            `UPDATE SecurityOfficers 
            SET gender=$1,
            securityname=$2,
            username=$3,
            age=$4,
            contact=$5 
            WHERE id=$6`,
            values: [req.body.gender,
                req.body.name,
                req.body.username,
                req.body.age,
                req.body.contact,
                id]
        });
        res.status(200);
    } catch (err){ 
        console.log(err)
        res.status(500).json({
            error : true,
            message: err
        });
    }
})

authRouter.post('/profile/:id/update/password', async(req, res)=> {
    let id = req.params.id;
    let newPswd = req.body.newPassword;
    let oldPswd = req.body.oldPassword;
    let response ; 
    try{
        response = await db.one({
            name: "update the user password", 
            text: 
            `UPDATE SecurityOfficers 
            SET password = $1 
            WHERE id= $2 AND
            password = $3
            RETURNING id` ,
            values:[ newPswd, id, oldPswd]
        })
        res.status(200);
    }catch(err){
        console.log(err);
        res.status(500).json({
            wrongPassword: true,
            message: err
        })
    }
})

authRouter.post('/profile/:id/update/picture', fileUpload.single('profilepic'),async function(req,res){
    let uuid =  uuidv4(); // generate a uuid for the profile image upload 
    let path =  `security/${uuid}`;
    let file =  req.file;
    try { 
        console.log(path);
        console.log(file);
        // upload the profile pictures into aws

        // update the database table with the photokey
        // await db.one({ 
        //    name: "Update profile pictures of security "
        // })

    }catch(err){ 
        console.log(err);
    }
})


module.exports = authRouter;