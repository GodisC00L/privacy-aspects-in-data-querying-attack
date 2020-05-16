const DEBUG = false;
const localhost = true;
let SERVER = "http://localhost:8080";
if (!localhost) {
    SERVER = "https://immense-scrubland-97943.herokuapp.com"
}
const TYPE_OF_ANSWER = {
    ParticularVehicle:  0,
    SetOfVehicles:      1,
    UnsuccessfulAttack: -1
};
const DEFAULT_RESOLUTION = 0.1;
const EPSILON = 0.00001;
const DIRECTION = {
    FORWARD: 0,
    BACKWARD: 1
};

let k;

let MIN_MAX_VALUES = {
    minY: -1,
    minX: -1,
    maxY: -1,
    maxX: -1
};

function DataBodyFormat(timestamp, x1, y1, x2, y2) {
    this.timestamp = timestamp;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
}

function is_server() {
    return ! (typeof window != 'undefined' && window.document);
}
const axiosClient = is_server() ? require('axios') : window.axios;
axiosClient.interceptors.response.use(function (response) {
    return response.data;
}, function (error) {

    return Promise.reject(error);
});
const setKVal = (newK) => {
    return axiosClient.put(
        SERVER + "/api/v1/db/setK",
        newK,
        {headers: {'Content-Type': 'application/json'}}
    ).then((res) => {
        k = res;
        return res;
    })
        .catch((err) => {
            console.error(err);
        })
};

const getAvgVelocity = (dataBody) => {
    return axiosClient.post(
        SERVER + "/api/v1/db/avgVelocity",
        dataBody,
        {headers: {"Content-Type": "application/json"}}
    );
};

const getKVal = () => {
    return axiosClient.get(
        SERVER + "/api/v1/db/getK"
    ).then((res) => {
        k = res;
        return res;
    });
};

const getMinMaxValues = () => {
    return axiosClient.get(SERVER + "/api/v1/db/getMinMaxValues")
        .then((res) => {
            MIN_MAX_VALUES = res;
            return res;
        });
};

const getNumOfVehicles = (timestamp) => {
    return axiosClient.post(
        SERVER + "/api/v1/db/numOfVehicles",
        timestamp,
        {headers: {"Content-Type": "application/json"}}
    );
};

const singleTargetAttack2D = (timestamp, xTarget, yTarget) => {
    return Promise.all([
        getKVal(),
        getMinMaxValues(),
    ]).then(() => {
        if(k === 1) {
            DEBUG && DEBUG && console.log("k === 1");
            return getAvgVelocity({
                timestamp: timestamp,
                x1: xTarget,
                y1: yTarget,
                x2: xTarget,
                y2: yTarget
            }).then((res) => {
                return {
                    avgVelocity: res,
                    type: TYPE_OF_ANSWER.ParticularVehicle
                };
            });
        }
        return Promise.all([
            // TopAreaIncludeMid = ((xMin,yTarget),(xMax,yMax))
            getAvgVelocity({
                timestamp: timestamp,
                x1: MIN_MAX_VALUES.minX,
                y1: yTarget,
                x2: MIN_MAX_VALUES.maxX,
                y2: MIN_MAX_VALUES.maxY
            }),

            // TopArea = ((xMin,yTarget+epsilon),(xMax,yMax))
            getAvgVelocity({
                timestamp: timestamp,
                x1: MIN_MAX_VALUES.minX,
                y1: yTarget + EPSILON,
                x2: MIN_MAX_VALUES.maxX,
                y2: MIN_MAX_VALUES.maxY
            }),

            // BotAreaIncludeMid = ((xMin,yMin),(xMax,yTarget))
            getAvgVelocity({
                timestamp: timestamp,
                x1: MIN_MAX_VALUES.minX,
                y1: MIN_MAX_VALUES.minY,
                x2: MIN_MAX_VALUES.maxX,
                y2: yTarget
            }),

            // BotArea = ((xMin,yMin),(xMax,yTarget-epsilon))
            getAvgVelocity({
                timestamp: timestamp,
                x1: MIN_MAX_VALUES.minX,
                y1: MIN_MAX_VALUES.minY,
                x2: MIN_MAX_VALUES.maxX,
                y2: yTarget - EPSILON
            }),

            // Area = ((xMin,yMin),(xMax,yMax))
            getAvgVelocity({
                timestamp: timestamp,
                x1: MIN_MAX_VALUES.minX,
                y1: MIN_MAX_VALUES.minY,
                x2: MIN_MAX_VALUES.maxX,
                y2: MIN_MAX_VALUES.maxY
            }),

            getNumOfVehicles(timestamp)
        ]).then((values) => {

            // If one of the 5 queries returned -1 we perform 1D attack (?!)
            if(values.some(value => value < 0)) {
                DEBUG && DEBUG && console.log("one of the values < 0");
                return attack1D(timestamp, xTarget, yTarget);
            }

            const results = {
                st: values[0],
                st_: values[1],
                sb: values[2],
                sb_: values[3],
                sn: values[4],
                n: values[5]
            };

            const v = results.sn * (results.st_ + results.sb_ - results.st - results.sb);
            let m = (results.n * (v + (results.sb * results.st) - (results.sb_ * results.st_)))
                / ((results.sb_ - results.st) * (results.sb - results.st_));
            m = Math.round(m);

            if(m < k) {
                let sm = ((results.sb_ * results.st_ - results.sb * results.st)
                    * results.sn + (results.st - results.st_) * results.sb * results.sb_
                    + (results.sb - results.sb_) * results.st * results.st_)
                    / (results.sb * results.st + v - results.sb_ * results.st_);
                sm = Math.round(sm * 100.0) / 100.0;
                return {
                    avgVelocity: sm,
                    type: m === 1 ? TYPE_OF_ANSWER.ParticularVehicle : TYPE_OF_ANSWER.SetOfVehicles
                };
            } else if (m > k) {
                return attack1D(timestamp, xTarget, yTarget);
            } else {
                return {
                    avgVelocity: -1,
                    type: TYPE_OF_ANSWER.UnsuccessfulAttack
                };
            }
        });
    });
};

const attack1D = (timestamp, xTarget, yTarget) => {
    let dataBody = new DataBodyFormat(timestamp, xTarget, yTarget, xTarget, yTarget);

    DEBUG && console.log("attack1D");
    DEBUG && console.log("dataBody: ", dataBody);

    return isEvenPossible(dataBody).then((bothDirectionResults) => {

        DEBUG && console.log("isEvenPossible.then bothDirectionResults: ", bothDirectionResults);

        if(bothDirectionResults[DIRECTION.FORWARD] !== -1) {
            dataBody.x1 += EPSILON;
            dataBody.x2 += 2 * EPSILON;
            DEBUG && console.log("Forward: dataBody: ", dataBody);

            return attack1DInner(dataBody, DIRECTION.FORWARD)
                .then((res) => {
                    DEBUG && console.log("Forward: attack1DInner.then: ", res);
                    let sAvg1 = res.sAvg;
                    if(sAvg1 === -1) {
                        return {
                            avgVelocity: -1,
                            type: TYPE_OF_ANSWER.UnsuccessfulAttack
                        };
                    }

                    dataBody.x1 = xTarget;
                    dataBody.x2 = res.dataBody.x2;
                    DEBUG && console.log("sAvg1: " + sAvg1);
                    DEBUG && console.log("dataBody: ", dataBody);
                    return getAvgVelocity(dataBody)
                        .then((sAvg2) => {
                            let sAvg = (k + 1) * sAvg2 - (k * sAvg1);
                            return {
                                avgVelocity: sAvg,
                                type: TYPE_OF_ANSWER.ParticularVehicle
                            };
                        });
                });
        } else if (bothDirectionResults[DIRECTION.BACKWARD] !== -1) {
            return attack1DInner(dataBody, DIRECTION.BACKWARD)
                .then((res) => {
                    let sAvg1 = res.sAvg;
                    if(sAvg1 === -1) {
                        return {
                            avgVelocity: -1,
                            type: TYPE_OF_ANSWER.UnsuccessfulAttack
                        };
                    }

                    dataBody.x1 = res.dataBody.x1;
                    dataBody.x2 = xTarget;

                    return getAvgVelocity(dataBody)
                        .then((sAvg2) => {
                            let sAvg = (k + 1) * sAvg2 - (k * sAvg1);
                            DEBUG && console.log("ret ans:", sAvg);
                            return {
                                avgVelocity: sAvg,
                                type: TYPE_OF_ANSWER.ParticularVehicle
                            };
                        });
                });
        }
        return {
            avgVelocity: -1,
            type: TYPE_OF_ANSWER.UnsuccessfulAttack
        };
    });
};

const attack1DInner = (dataBody, direction) => {
    let sAvg = -1;
    DEBUG && console.log("attack1DInner: dataBody: ", dataBody);

    return getSAvg(dataBody, direction, 1).then((res) => {
        DEBUG && console.log("attack1DInner: getSAvg.then:");

        sAvg = res.sAvg;
        dataBody = res.dataBody;

        DEBUG && console.log("sAvg: " + sAvg);
        DEBUG && console.log("dataBody:", dataBody);

        if(sAvg !== -1) {
            if(direction === DIRECTION.FORWARD) {
                DEBUG && console.log(dataBody);
                dataBody.x2 -= 1;
            } else {
                dataBody.x1 += 1;
            }
            return getAccurateVelocity(-1, dataBody, direction, DEFAULT_RESOLUTION).then((res) => {
                DEBUG && console.log("attack1DInner: getSAvg.then: getAccurateVelocity.then: return", res);
                return res;
            })
        } else {
            return {sAvg, dataBody};
        }
    });
};

const getAccurateVelocity = (oldVelocity, dataBody, direction, resolution) => {
    DEBUG && console.log("getAccurateVelocity: ");
    DEBUG && console.log("oldVelocity: " + oldVelocity);
    DEBUG && console.log("dataBody: ", dataBody);
    DEBUG && console.log("direction: " + direction);
    DEBUG && console.log("resolution: " + resolution);

    if(resolution === (DEFAULT_RESOLUTION/1000)) {
        return {oldVelocity, dataBody};
    }

    resolution /= 10;
    return getSAvg(dataBody, direction, resolution).then((res ) => {
        if(oldVelocity === res.sAvg) {
            DEBUG && console.log("Vel equal: ret:", res);
            return res;
        }
        return getAccurateVelocity(res.sAvg, dataBody, direction, resolution);
    });
};

const getSAvg = (dataBody, direction, resolution) => {
    DEBUG && console.log("getSAvg: dataBody: ", dataBody);
    DEBUG && console.log("Direction: " + direction);
    DEBUG && console.log("Resolution: " + resolution);

    return getAvgVelocity(dataBody)
        .then((sAvg) => {
            DEBUG && console.log("getSAvg: getAvgVelocity.then: sAvg: " + sAvg);
            DEBUG && console.log("getSAvg: getAvgVelocity.then: dataBody:", dataBody);

            if (!isInRangeX(dataBody.x1, dataBody.x2)) {
                return {sAvg, dataBody};
            }
            else if (sAvg === -1) {
                if(direction === DIRECTION.FORWARD) {
                    dataBody.x2 += resolution;
                }
                else {
                    dataBody.x1 -= resolution;
                }
                return getSAvg(dataBody, direction, resolution);
            }
            else {
                return {sAvg, dataBody};
            }
        })
};

const isEvenPossible = (dataBody) => {
    DEBUG && console.log("isEvenPossible:");
    DEBUG && console.log("dataBody: ", dataBody);

    let forwardDataBody = new DataBodyFormat(dataBody.timestamp, dataBody.x1, dataBody.y1, dataBody.x2, dataBody.y2);
    forwardDataBody.x1 = forwardDataBody.x1 + EPSILON;
    forwardDataBody.x2 = MIN_MAX_VALUES.maxX;

    let backwardDataBody = new DataBodyFormat(dataBody.timestamp, dataBody.x1, dataBody.y1, dataBody.x2, dataBody.y2);
    backwardDataBody.x1 = MIN_MAX_VALUES.minX;
    backwardDataBody.x2 = backwardDataBody.x2 - EPSILON;


    DEBUG && console.log("forwardDataBody: ", forwardDataBody);
    DEBUG && console.log("backwardDataBody: ", backwardDataBody);

    return Promise.all(
        [
            // Checking if possible forward
            getAvgVelocity(forwardDataBody),

            // Checking if possible backward
            getAvgVelocity(backwardDataBody)
        ]).then((results) => {
        return results;
    });
};

const isInRangeX = (x1, x2) => {
    return (x1 >= MIN_MAX_VALUES.minX && x2 <= MIN_MAX_VALUES.maxX);
};

const getMaxVelocity = (dataBody) => {
    return axiosClient.post(
        SERVER + "/api/v1/db/getMaxVelocity",
        dataBody,
        {headers: {"Content-Type": "application/json"}}
    );
};


const maxVelAttack = (data, fileToWrite) => {
    Object.keys(data).forEach(key => {
        const xListForTs = data[key];
        const listSize = xListForTs.length;
        let xTarget = xListForTs[0];
        let tempTarget = xTarget;

        console.log("xTarget: " + xTarget);
        console.log("xListSize: " + listSize);
        console.log("K = " + k);
        // If no K elements in arrays
        if(k > listSize) {
            fileToWrite.write(Object.values({
                timestamp: key,
                X: xTarget,
                velocity: -1,
            }) + '\n');
            return;
        }

        Promise.all([
            getMaxVelocity({
                timestamp: key,
                x1: xTarget,
                y1: DEFAULT_RESOLUTION,
                x2: xListForTs[k - 1],
                y2: DEFAULT_RESOLUTION
            })]).then((maxVel) => {
            console.log("First Max Vel: " + maxVel[0]);
            async function maxVelAttack() {
                const foundVelocity = [];
                for (let i = 1; i < listSize; i++) {
                    let obj = {
                        timestamp: key,
                        X: -1,
                        velocity: -1
                    };
                    if(i >= listSize - k) {
                        if(!foundVelocity.includes(xListForTs[i])) {
                            obj.X = xListForTs[i];
                            fileToWrite.write(Object.values(obj) + '\n');
                        }
                        continue;
                    }
                    xTarget = tempTarget;
                    tempTarget = xListForTs[i];
                    const maxVelTemp = await getMaxVelocity({
                        timestamp: key,
                        x1: tempTarget,
                        y1: DEFAULT_RESOLUTION,
                        x2: xListForTs[i + k - 1],
                        y2: DEFAULT_RESOLUTION
                    });

                    console.log(i);
                    console.log("maxVel: " + maxVel[0] + " maxVelTemp: " + maxVelTemp);
                    if (maxVelTemp > maxVel[0]) {
                        obj.X = xListForTs[i + k - 1];
                        obj.velocity = maxVelTemp;
                        foundVelocity.push(obj.X);
                        fileToWrite.write(Object.values(obj) + '\n');
                        obj.X = xTarget;
                        obj.velocity = -1;
                        fileToWrite.write(Object.values(obj) + '\n');
                    } else if (maxVelTemp < maxVel[0]) {
                        obj.X = xTarget;
                        obj.velocity = maxVel[0];
                        foundVelocity.push(obj.X);
                        fileToWrite.write(Object.values(obj) + '\n');
                    } else if (!foundVelocity.includes(xTarget)) {
                        obj.X = xTarget;
                        fileToWrite.write(Object.values(obj) + '\n');
                    }
                    maxVel[0] = maxVelTemp;
                }
            }
            maxVelAttack().then( () => console.log("done"));
        });
    });
};

if (is_server()) {
    exports.attackSingleRow = (timestamp, xTarget, yTarget) => {
        return singleTargetAttack2D(timestamp, xTarget, yTarget);
    };

    exports.setK = (setk) => {
        return setKVal(setk);
    };


    exports.attackMaxFile = (data, fileToWrite) => {
        return getKVal().then( () => {
            return maxVelAttack(data, fileToWrite);
        })
    };
}

