const { fromIni } = require("@aws-sdk/credential-provider-ini")
const { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand} = 
    require("@aws-sdk/client-s3")

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

module.exports = { getBucketList, uploadToBucket, BUCKETNAME }

// delete object in bucket 
// upload object to bucket 
// get bucketlist 
// get object url 
// get object 