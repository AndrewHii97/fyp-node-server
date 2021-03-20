const express = require("express")
const db = require('../db')
const multer = require('multer')
const personRouter = express.Router()
const log = require('npmlog')
log.level = 'all'
log.heading = 'person'

// middleware 
personRouter.use(express.json())
personRouter.use(express.urlencoded({
    extended: true
}))
upload = multer()
personRouter.use(upload.any())

// route 

personRouter.post('/create/resident',(req,res,next)=>{
    // create a person
    // create a resident 
})

personRouter.post('/create/visitor',(req,res,next)=>{
    // create a person 
    // create a visitor
})

personRouter.post('/create/family',(req,res,next)=>{
    // create a person 
    // create a visitor 
})

personRouter.post('/upload/s3/pic',(req,res,next)=>{
    // uplaod picture into s3 bucket 
})

personRouter.post('/create/photo',(req,res,next)=>{
    // create new photo in database 
})
