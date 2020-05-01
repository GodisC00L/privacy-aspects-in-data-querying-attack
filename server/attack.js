const fs = require('fs');
const client = require('../client/client');
const csv = require('fast-csv');

let rows = [];
let K = [];
let id = 1;


exports.attackFile = (cb) => {
    const attackedFile = fs.createWriteStream('tmp/csv/attacked.csv');
    const attackFileOriginal = fs.createReadStream('tmp/csv/target.csv')
        .pipe(csv.parse({headers: true}))
        .on('error', err => console.error(err))
        .on('headers', (row) => {
            attackFileOriginal.pause();
            row.splice(4,2);
            attackedFile.write('ID,' + row + '\n');
            for (let i = 4; i < row.length; i++) {
                K.push(row[i]);
            }
            attackFileOriginal.resume();
        })
        .on('data', (row) => {
            attackFileOriginal.pause();
            let outObj = {
                ID: id,
                timestamp: row['Timestamp'],
                X: parseFloat(row['X']),
                Y: parseFloat(row['Y']),
                velocity: -1,
                answers: []
            };
            const attackInARow = async () => {
                for (let i = 0; i < K.length - 1; i++) {
                    let hrstart = process.hrtime();
                    const res = await client.attackSingleRow(
                        outObj.timestamp,
                        outObj.X,
                        outObj.Y,
                        K[i]
                    );
                    outObj.answers.push(process.hrtime(hrstart)[1] / 1000000);
                    if(res.avgVelocity === -1)
                        break;
                    if(i===0) outObj.velocity = res.avgVelocity;
                }
            };
            attackInARow().then(() => {
                attackedFile.write(Object.values(outObj) + '\n');
                id += 1;
                //attackFileOriginal.emit('donereading');
                attackFileOriginal.resume();
            }).catch((err) => {
                console.error(err);
            });
        })
        .on('end', (rowCount) => {
            console.log(`Attacked ${rowCount} rows`);
            attackFileOriginal.close();
            attackedFile.close();
        })
        .on('donereading', function(){
            attackFileOriginal.close();
            console.log('got 20 rows', rows);
        })
};
