const express = require('express');
const db = require('../db');
const authRouter = express.Router();

authRouter.use(express.urlencoded({extended: true}));

authRouter.post('/auth', async (req, res)=> { 
    let username = req.body.username;
    let password = req.body.password; 
    try{ 
        data = await db.one({ 
            name: 'authenticate web app user',
            text: `SELECT * FROM SECURITYOFFICERS WHERE USERNAME = $1 AND 
                   PASSWORD = $2`,
            values: [username, password] 
        });
        res.json({
            "isValid": true
        });
    }catch(err){ 
        res.json({
            "isValid": false
        });
    }
});


module.exports = authRouter;