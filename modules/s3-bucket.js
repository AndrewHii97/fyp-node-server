const { fromIni } = require("@aws-sdk/credential-provider-ini")
const { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand} = 
    require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")

const BUCKETNAME = 'tgfypbucket';

// create s3 client object used by other f(x)
const s3 = new S3Client({
    "region": "us-east-1",
    "credentials":  fromIni({})
});

/*
* f(x) : upload object to s3 bucket using @aws-sdk/client-s3 
* paramater : key, bucketName, body 
* key           => filename exists in the s3 bucket 
* bucketName    => name of bucket 
* body          => image data in term of buffer 
* return : response success or error   
*/
async function uploadToBucket(key,bucketName,body){ 
    const data = await s3.send( 
        new PutObjectCommand({
            "Key" : key,
            "Bucket" : bucketName,
            "Body" : body 
        })
    )
    return data;
}

/*
* f(x): get the list of bucket in s3 storage 
* return : response message from s3 (require further processing) 
* misc : normally used to test connection to s3 bucket 
*/
async function getBucketList(){ 
    try{ 
        const data = await s3.send(new ListBucketsCommand({}));
        return data;
    }catch(err){ 
        console.log("Get Bucket List Error Message");
        console.log(err);
        return err;
    }
}

async function getS3ObjHead(bucket, key){ 
    objMeta = await s3.send(
        new HeadObjectCommand({ 
           "Bucket": bucket,
           "Key": key
        })
    )
    return objMeta
}

async function getS3Obj(bucket,key){ 
    obj = await s3.send(
        new GetObjectCommand({ 
            "Bucket": bucket,
            "Key":key
        })
    )
    return obj 
}

async function getUrlS3Obj(bucket,key,time){
    let command = new GetObjectCommand({
        "Bucket": bucket,
        "Key": key
    })
    const url = await getSignedUrl(s3,command,{expiresIn: time})
    return url 
}

async function deleteS3Obj(bucket,key){
    response = s3.send(new DeleteObjectCommand({
        "Bucket":bucket,
        "Key":key
    }))
    return response
}

module.exports = { 
    BUCKETNAME,
    getBucketList,
    uploadToBucket,
    getS3Obj,
    getS3ObjHead,
    getUrlS3Obj,
    deleteS3Obj 
}
