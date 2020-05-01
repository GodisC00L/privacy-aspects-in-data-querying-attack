const fs = require('fs');
const client = require('../client/client');
const csv = require('fast-csv');
const cliProgress = require('cli-progress');

let K = [];
let id = 1;


exports.attackFile = (cb) => {
    const totalSize = fs.statSync('server/tmp/csv/target.csv').size;
    const pBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let read = 0;
    pBar.start(totalSize, 0);
    let startAttackTime = new Date();
    const attackedFile = fs.createWriteStream('server/tmp/csv/attacked.csv');
    const attackFileOriginal = fs.createReadStream('server/tmp/csv/target.csv');
    const parser = csv.parseStream(attackFileOriginal, {headers: true})
        .on('error', err => console.error(err))
        .on('headers', (row) => {
            parser.pause();
            read += row.toString().length;
            row.splice(4,2);
            attackedFile.write('ID,' + row + '\n');
            for (let i = 4; i < row.length; i++) {
                K.push(row[i]);
            }
            pBar.update(read);
            parser.resume();
        })
        .on('data', (row) => {
            parser.pause();
            read += row.toString().length;
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
                pBar.update(read);
                if(read > 75000)
                    parser.emit('end');
                parser.resume();
            }).catch((err) => {
                console.error(err);
            });
        })
        .on('end', () => {
            pBar.stop();
            let endAttackTime = new Date() - startAttackTime;
            console.log('Total attack time: %dms', endAttackTime);
            attackFileOriginal.destroy();
            attackedFile.close();
        })
};
