const fs = require('fs');
const client = require('../client/client');
const csv = require('fast-csv');
const exec = require('child_process').execSync;


const pathTarget = 'tmp/csv/target.csv';
const pathAttacked = 'tmp/csv/attacked.csv';

exports.attackFile = (cb) => {
    const io = require('../server/app').io;
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
            K = row[4];
            io.emit('attackProgress', {done: read, totalSize: totalSize});
            parser.resume();
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
                io.emit('attackProgress', {done: ++read, totalSize: totalSize});
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
