const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const attackApi = require('./attack');

const port = process.env.PORT || 3000;

app.use(express.static(path.resolve(__dirname, '..', 'client')));


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'tmp/csv/');
    },
    filename: function (req, file, cb) {
        cb(null, 'target.csv');
    },
    onFileUploadStart: (file) => {
        console.log(file.originalname + ' is starting...');
    },
    onFileUploadComplete: (file) => {
        console.log(file.filename + ' uploaded to ' + file.path);
    }
});
const upload = multer({storage: storage}).any();
app.use(upload);

app.post('/api/upload', (req, res) => {
    upload(req, res, (err) => {
        if(err)
            return res.end('Error uploading file');
        res.end('File uploaded!');
        attackApi.attackFile(err => console.log(err));
    });
});

const server = app.listen(port, (err) => {
    if(err) {
        console.error(err);
        return;
    }
    console.log('Listening on port', server.address().port);
});

