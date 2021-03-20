// function to be tested 
const {
    createS3Image,
    createByteImage,
    createCollection,
    deleteCollection,
    listCollection,
    createDetectLabelsCommand,
    analyseImage,
    indexFaces2Collection,
    deleteIndexedFaces,
    detectFaces,
    searchFacesWithId,
    COLLECTION
} = require('../rekog.js')

// testing function 
// test 1 - tick 
const {BUCKETNAME} = require("../s3-bucket");
async function testAnalyseS3Image(){
    try{
        s3Image = createS3Image(BUCKETNAME,"scene2.jpg")
        console.log(s3Image)
        labelC = createDetectLabelsCommand(s3Image)
        console.log(labelC)
        data = await analyseImage(labelC)
        console.log(data)
    }catch(err){
        console.log(err)
    }
}
// testAnalyseS3Image();
// test 2 - tick 
const fs = require('fs');
const { CreateBucketCommand } = require("@aws-sdk/client-s3");
async function testAnalyzeByteImage(){ 
    try {
        let byte = fs.readFileSync("../test-image/scene2.jpg");
        console.log(byte)
        byteImage = createByteImage(byte)
        console.log(byteImage)
        labelC = createDetectLabelsCommand(byteImage)
        console.log(labelC)
        data = await analyseImage(labelC)
        console.log(data)
    }catch(err){
        console.log(err)
    }
}
// testAnalyzeByteImage();
// test 3 - tick
async function testCreateCollection(){ 
    try { 
        data = await createCollection("test")
        console.log(data)
    }catch(err){ 
        console.log(err)
    }
}
// testCreateCollection()
// test 4 - tick 
async function testListCollection(){
    try{
        response = await listCollection()
        console.log(response)
    }catch(err){ 
        console.log(err)
    }
}
// testListCollection()
// test 5 - tick 
async function testDeleteCollection(){
    try{ 
        response = await deleteCollection("test") 
        console.log(response)
    }catch(err){ 
        console.log(err)
    }
}
// testDeleteCollection()
// test 6 - tick 
async function testIndexFaces2CollectionByte(){
    try{ 
        bytes = fs.readFileSync("../test-image/scene3.jpg")
        image = createByteImage(bytes)
        faces = await indexFaces2Collection("images",image) 
        console.log(faces)
    }catch(Err){ 
        console.log(Err)
    }
}
// testIndexFaces2CollectionByte()
// test 7 - tick
async function testIndexFaces2CollectionS3(){
    try{
        image = createS3Image("tgfypbucket","faustina.jpg")
        faces = await indexFaces2Collection("images",image)
        console.log(faces)
    }catch(err){
        console.log(err)
    }
}
// testIndexFaces2CollectionS3()
// test 8 - tick 
async function testDeleteIndexedFaces(){
    try{ 
        faceid = ['22d5f521-857c-4ce8-8dbf-aa9da2f815ab']
        response = await deleteIndexedFaces('images',faceid)
        console.log(response)
    }catch(err){ 
        console.log(err)
    }
}
// testDeleteIndexedFaces()
// test 9 - tick 
async function testDetectFacesBytes(){ 
    try{ 
        bytes = fs.readFileSync("../test-image/scene1.jpg")
        image = createByteImage(bytes)
        response = await detectFaces(image,["ALL"])
        console.log(response)
    }catch(err){
        console.log(err)
    }
}
// testDetectFacesBytes()
// test 10 - tick  
async function testDetectFacesS3(){ 
    try{ 
        image = createS3Image(BUCKETNAME,"scene1.jpg")
        response = await detectFaces(image,["ALL"])
        console.log(response)
    }catch(err){
        console.log(err)
    }
}
// testDetectFacesS3()
// test 11 - tick 
async function testSearchFacesWithId(){ 
    try{
        faceid = 'e5e91f3f-f584-4624-ae64-876d121c3731'
        response = await searchFacesWithId(COLLECTION,faceid)
        console.log(response)
    }catch(err){
        console.log(err)
    }
}
// testSearchFacesWithId()