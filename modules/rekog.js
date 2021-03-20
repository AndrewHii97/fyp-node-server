// rekognition Client 
const {RekognitionClient, SearchFacesCommand} = require("@aws-sdk/client-rekognition");
// import Label Operation 
const {DetectLabelsCommand} = require("@aws-sdk/client-rekognition");
// import collection operation 
const {CreateCollectionCommand, DeleteCollectionCommand,ListCollectionsCommand}
= require("@aws-sdk/client-rekognition");
// import index faces operation 
const {IndexFacesCommand, DeleteFacesCommand} = require("@aws-sdk/client-rekognition")
// import detect faces operation 
const {DetectFacesCommand} = require("@aws-sdk/client-rekognition")
const {fromIni} = require("@aws-sdk/credential-provider-ini");

const COLLECTION = "faces"

const rekog = new RekognitionClient({
    region: "us-east-1",
    credentials: fromIni({})
})

function createS3Image(s3BucketName,imagekey){ 
    let image = {"S3Object": { 
        "Bucket": s3BucketName,
        "Name": imagekey
    }}
    return image;
}

function createByteImage(bytes){ 
    let image = { 
        "Bytes": bytes
    }
    return image
}

function createDetectLabelsCommand(image,maxlabels=undefined,minconfidence=undefined){
    return new DetectLabelsCommand({
        "Image":image,
        "MaxLabels": maxlabels,
        "MinConfidence": minconfidence
    })
}

async function analyseImage(detectLabelsCommand){ 
    response =await rekog.send(detectLabelsCommand)
    return response;
}

async function listCollection(){
    collectionList = await rekog.send(new ListCollectionsCommand({}));
    return collectionList
} 

async function createCollection(collectionName){ 
    // create a collection
    response = await rekog.send(new CreateCollectionCommand({ 
        "CollectionId": collectionName
    }))
    return response
}

async function deleteCollection(collectionName){
    // delete collection specify 
    response = await rekog.send(new DeleteCollectionCommand({
        "CollectionId": collectionName
    }))
    return response
}
/** 
* collectionName & Image required 
* DetectionAttribute : ["DEFAULT"] OR ["ALL"] OR [<listofAtt>]
* ExternalImageid : Name the indexed faces is associated with 
* Image : s3Object or byte // already created factory function 
* QualityFilter : "HIGH","MEDIUM","HIGH"
* MaxFaces : value range from 1 - 100 
*/
async function indexFaces2Collection(collectionName,Image,DetectionAttributes=["DEFAULT"],ExternalImageId=undefined,MaxFaces=undefined,QualityFilter="NONE" ){
    response = await rekog.send( new IndexFacesCommand({ 
       "CollectionId": collectionName,
       "ExternalImageId": ExternalImageId,
       "Image": Image,
       "DetectionAttributes": DetectionAttributes,
       "MaxFaces": MaxFaces,
       "QualityFilters": QualityFilter
    }))
    return response 
}

// facesId need to be in array form
async function deleteIndexedFaces(collectionName,facesId=[]){ 
    response = await rekog.send(new DeleteFacesCommand({
        "CollectionId":collectionName,
        "FaceIds":facesId
    }))
    return response
}

/** 
 * detectFaces 
 * param : image, attribute 
 * image => can be bytes or s3object 
 * attribute => ["DEFAULT"] OR ["ALL"] OR [<listofAtt>]
*/
async function detectFaces(image, attribute=["DEFAULT"]){ 
    response = await rekog.send(new DetectFacesCommand({ 
        "Attributes": attribute,
        "Image": image
    }))
    return response
}

async function searchFacesWithId(collection,faceid){
    // return faces with 80% confidence and higher 
    faces = await rekog.send(new SearchFacesCommand({
        "CollectionId": collection,
        "FaceId": faceid
    }))
    return faces
    // Response: FaceMatches, FaceModelVersion, SearchedFaceId
}

module.exports =
{
    COLLECTION,
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
    searchFacesWithId
}