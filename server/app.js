const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const attackApi = require('./attack');
const mkdirp = require('mkdirp');


const port = process.env.PORT || 3000;

app.use(express.static(path.resolve(__dirname, '..', 'client')));
try {
    mkdirp.sync(path.resolve(__dirname, '..', 'tmp', 'csv'));
} catch (e) {
    console.log(e);
}
app.use("/files", express.static(path.resolve(__dirname, '..', 'tmp', 'csv')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'tmp/csv/');
    },
    filename: function (req, file, cb) {
        if(file.originalname.includes('Max'))
            cb(null, 'targetMax.csv');
        else if(file.originalname.includes('Min'))
            cb(null, 'targetMin.csv');
        else
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

app.post('/api/upload/avgVel', (req, res) => {
    upload(req, res, (err) => {
        if(err)
            return res.end('Error uploading file');
        res.end('File uploaded!');
        attackApi.attackFileAvgVelocity((res, err) => {
            if(err) {
                console.log(err);
                return;
            }
            io.emit('fileReady');
        });
    });
});

app.post('/api/upload/maxVel', (req, res) => {
    upload(req, res, (err) => {
        if(err) {
            return res.end('Error uploading file');
        }
        res.end('File Uploaded!');
        attackApi.attackFileMax((res, err) => {
            if(err) {
                console.log(err);
                return;
            }
            io.emit('fileReady');
        })
    })
});

const server = app.listen(port, (err) => {
    if(err) {
        console.error(err);
        return;
    }
    console.log('Listening on port', server.address().port);
});

const io = require('socket.io')(server);
exports.io = io;
