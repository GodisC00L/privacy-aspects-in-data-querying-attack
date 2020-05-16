const fs = require('fs');
const client = require('../client/client');
const csv = require('fast-csv');
const exec = require('child_process').execSync;




exports.attackFileAvgVelocity = (cb) => {
    const io = require('../server/app').io;
    const pathTarget = 'tmp/csv/target.csv';
    const pathAttacked = 'tmp/csv/attacked.csv';

    const THRESHOLD = 50;
    let current = 0;

    let K;
    let counter = 0;

    const totalSize = parseInt(exec('cat ' + pathTarget + ' | wc -l'));
    let read = 0;

    let startAttackTime = new Date();
    const attackedFile = fs.createWriteStream(pathAttacked);
    const attackFileOriginal = fs.createReadStream(pathTarget);
    const parser = csv.parseStream(attackFileOriginal, {headers: true})
        .on('error', err => console.error(err))
        .on('headers', (row) => {
            parser.pause();
            ++read;
            row.splice(4,2);
            attackedFile.write('ID,' + row + '\n');
            //TODO: what if no K?
            K = row[4];
            client.setK(K).then(() => {
                io.emit('attackProgress', {done: read, totalSize: totalSize});
                parser.resume();
            });
        })
        .on('data', (row) => {
            if (++current >= THRESHOLD) {
                parser.pause();
            }
            let id = ++counter;

            let outObj = {
                ID: id,
                timestamp: row['Timestamp'],
                X: parseFloat(row['X']),
                Y: parseFloat(row['Y']),
                velocity: -1,
                answers: 0
            };

            let hrstart = process.hrtime();
            client.attackSingleRow(
                outObj.timestamp,
                outObj.X,
                outObj.Y,
                K
            ).then((res) => {
                outObj.answers = process.hrtime(hrstart)[1] / 1000000;
                outObj.velocity = res.avgVelocity;
                attackedFile.write(Object.values(outObj) + '\n');
                //io.emit('attackProgress', {done: ++read, totalSize: totalSize});
                if (read >= totalSize) {
                    attackedFile.close();
                    cb();
                }
                --counter;
                parser.resume();
            }).catch((err) => {
                console.error(err);
            });
        })
        .on('end', () => {
            let endAttackTime = new Date() - startAttackTime;
            console.log('Total attack time: %dms', endAttackTime);
            attackFileOriginal.destroy();
        })
};

exports.attackFileMax = (cb) => {
    console.log("Attack File Max");


    const io = require('../server/app').io;
    const _ = require('lodash');

    const data = {};

    const pathTarget = 'tmp/csv/targetMax.csv';
    const pathAttacked = 'tmp/csv/attackedMax.csv';

    const totalSize = parseInt(exec('cat ' + pathTarget + ' | wc -l'));
    let read = 0;

    const attackedFile = fs.createWriteStream(pathAttacked);
    const attackFileOriginal = fs.createReadStream(pathTarget);
    const parser = csv.parseStream(attackFileOriginal, {headers: true})
        .on('error', err => console.error(err))
        .on('headers', (row) => {
            attackedFile.write(Object.values(row)  + '\n');
        })
        .on('data', (row) => {
            // Create list of X for each timestamp
            const timestamp = row['Timestamp'];
            const X = row['X'];

            if(!data[timestamp])
                data[timestamp] = [];
            data[timestamp].push(X);
            io.emit('fileMaxProgress', {done: ++read, totalSize: totalSize});
        })
        .on('end', () => {
            fixData(data).then(() => {
                client.attackMaxFile(data, attackedFile);
            }).catch((err) => {
                console.error(err);
            })
            /*Object.keys(data).forEach(key => {
                fixData()
            });
            client.attackMaxFile(data, attackedFile);*/
        });

    async function fixData(data) {
        for(const key of Object.keys(data))
            data[key] = await _.orderBy(data[key], 'x', 'asc');
    }

    const attackMaxVel = async (data) => {
        await fixData(data);
    }
};