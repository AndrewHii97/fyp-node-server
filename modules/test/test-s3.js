const{ 
    BUCKETNAME,
    getBucketList,
    uploadToBucket,
    getS3Obj,
    getS3ObjHead,
    getUrlS3Obj,
    deleteS3Obj
} = require('../s3-bucket')

// test 1 - tick 
async function testGetS3ObjHead(){ 
    try{
        response = await getS3ObjHead(BUCKETNAME,"andrew.jpg")
        console.log(response)
        console.log(response.Metadata)
        console.log(response.WebsiteRedirectLocation)
    }catch(err){
        console.log(err)
    }
}
// testGetObjHead()

// test 2 - tick 
async function testGetObj(){ 
    try{ 
        obj = await getS3Obj(BUCKETNAME,"andrew.jpg")
        console.log(obj)
    }catch(err){
        console.log(obj)
    }

}
// testGetObj()

// test 3 - tick  
async function testGetUrlObj(){
    try{ 
        url = await  getUrlS3Obj(BUCKETNAME,"andrew.jpg",3600)
        console.log(url)
    }catch(err){
        console.log(err)
    }
}
// testGetUrlObj()
async function testDeleteS3Obj(){
    try{ 
        let response = await deleteS3Obj(BUCKETNAME,"scene4.jpg")
        console.log(response)
    }catch(err){
        console.log(err)
    }
}
// testDeleteS3Obj()
