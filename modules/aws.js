const { fromIni } = require("@aws-sdk/credential-provider-ini")
const { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand} = 
    require("@aws-sdk/client-s3")
const fs = require('fs')

const bucketName = 'tgfypbucket';
const key = 'test.jpg'

// create s3 client to be used by other modules
const s3 = new S3Client({
    "region": "us-east-1",
    "credentials":  fromIni({
        configFilepath : "../aws_cc/aws-config.txt",
        filepath : "../aws_cc/aws-cred.txt"
    })
});


// read file to Buffer object
function readFile2Buffer(filename){ 
    return fs.readFileSync(filename);
    
};

function createTestStream(filename){ 
    return fs.createReadStream('test.jpg')
}

// key here means the file name in aws bucket
async function uploadToBucket(key,bucketName,body){ 
    const data = await s3.send( 
        new PutObjectCommand({
            "Key" : key,
            "Bucket" : bucketName,
            "Body" : body 
        })
    )
    return data; // return response after uploadt to bucket 
}

// Get Object from Bucket using the object key (obj name in bucket)
const getBucketList = async() => { 
    const data = await s3.send(
        new ListBucketsCommand({})
    ).catch((err,data)=>{
        console.log(err)
    });
    return data;
}
