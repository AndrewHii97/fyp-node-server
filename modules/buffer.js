const fs = require('fs')

// f(x): read file in sync & return a buffer 
function readFile2Buffer(filename){ 
    return fs.readFileSync(filename);
    
};

// f(x): from file name create & return readableStream obj 
function createTestStream(filename){ 
    return fs.createReadStream(filename)
}

