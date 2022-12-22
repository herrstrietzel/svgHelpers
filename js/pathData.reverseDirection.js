
/**
 * reverse pathdata
 */
function reversePathData(pathData, decimals = -1) {
    /**
     * make sure all command coordinates are absolute and
     * shorthands are converted to long notation
     */
    pathData = pathDataToLonghands(pathDataToAbsolute(pathData, decimals));

    // split to sub path array
    let pathDataArray = splitSubpaths(pathData);

    // start compiling new path data
    let pathDataNew = [];

    // helper to rearrange control points for all command types
    const reverseControlPoints = (type, values) => {
        let controlPoints = [];
        let endPoint = [];
        if (type !== "A") {
            for (let p = 0; p < values.length; p += 2) {
                controlPoints.push([values[p], values[p + 1]]);
            }
            endPoint = controlPoints.pop();
            controlPoints.reverse();
        }
        // is arc
        else {
            //reverse sweep;
            let sweep = values[4] == 0 ? 1 : 0;
            controlPoints = [values[0], values[1], values[2], values[3], sweep];
            endPoint = [values[5], values[6]];
        }
        return [controlPoints, endPoint];
    };

    pathDataArray.forEach((pathData) => {
        let closed =
            pathData[pathData.length - 1].type.toLowerCase() === "z" ? true : false;
        if (closed) {
            // add lineto closing space between Z and M
            pathData = addClosePathLineto(pathData);
            // remove Z closepath
            pathData.pop();
        }

        // define last point as new M if path isn't closed
        let valuesLast = pathData[pathData.length - 1].values;
        let valuesLastL = valuesLast.length;
        let M = closed
            ? pathData[0]
            : {
                type: "M",
                values: [valuesLast[valuesLastL - 2], valuesLast[valuesLastL - 1]]
            };
        // starting M stays the same – unless the path is not closed
        pathDataNew.push(M);

        // reverse path data command order for processing
        pathData.reverse();
        for (let i = 1; i < pathData.length; i++) {
            let com = pathData[i];
            let type = com.type;
            let values = com.values;
            let valuesL = values.length;
            let comPrev = pathData[i - 1];
            let typePrev = comPrev.type;
            let valuesPrev = comPrev.values;
            // get reversed control points and new end coordinates
            let [controlPointsPrev, endPointsPrev] = reverseControlPoints(
                typePrev,
                valuesPrev
            );
            let [controlPoints, endPoints] = reverseControlPoints(type, values);

            // create new path data
            let newValues = [];
            newValues = controlPointsPrev.flat().concat(endPoints);
            pathDataNew.push({
                type: typePrev,
                values: newValues
            });
        }

        // add previously removed Z close path
        if (closed) {
            pathDataNew.push({
                type: "z",
                values: []
            });
        }
    });
    return pathDataNew;
}



/**
 * decompose shorthands to "longhand" commands:
 * H, V, S, T => L, L, C, Q
 * reversed method: pathDataToShorthands()
 */
function pathDataToLonghands(pathData) {
    pathData = JSON.parse(JSON.stringify(pathDataToAbsolute(pathData)));
    let pathDataLonghand = [];
    let comPrev = {
        type: "M",
        values: pathData[0].values
    };
    pathDataLonghand.push(comPrev);

    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];
        let type = com.type;
        let values = com.values;
        let valuesL = values.length;
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let [x, y] = [values[valuesL - 2], values[valuesL - 1]];
        let cp1X, cp1Y, cp2X, cp2Y;
        let [prevX, prevY] = [
            valuesPrev[valuesPrevL - 2],
            valuesPrev[valuesPrevL - 1]
        ];
        switch (type) {
            case "H":
                comPrev = {
                    type: "L",
                    values: [values[0], prevY]
                };
                break;
            case "V":
                comPrev = {
                    type: "L",
                    values: [prevX, values[0]]
                };
                break;
            case "T":
                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // new control point
                cpN1X = prevX + (prevX - cp1X);
                cpN1Y = prevY + (prevY - cp1Y);
                comPrev = {
                    type: "Q",
                    values: [cpN1X, cpN1Y, x, y]
                };
                break;
            case "S":
                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [cp2X, cp2Y] =
                    valuesPrevL > 2
                        ? [valuesPrev[2], valuesPrev[3]]
                        : [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // new control points
                cpN1X = 2 * prevX - cp2X;
                cpN1Y = 2 * prevY - cp2Y;
                cpN2X = values[0];
                cpN2Y = values[1];
                comPrev = {
                    type: "C",
                    values: [cpN1X, cpN1Y, cpN2X, cpN2Y, x, y]
                };

                break;
            default:
                comPrev = {
                    type: type,
                    values: values
                };
        }
        pathDataLonghand.push(comPrev);
    }
    return pathDataLonghand;
}

/**
 * apply shorthand commands if possible
 * L, L, C, Q => H, V, S, T
 * reversed method: pathDataToLonghands()
 */

function pathDataToShorthands(pathData, decimals = -1) {
    //pathData = JSON.parse(JSON.stringify( pathData));
    pathData = pathDataToAbsolute(pathData);
    //console.log(pathData)

    let comShort = {
        type: "M",
        values: pathData[0].values
    };
    let pathDataShorts = [comShort];
    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];
        let comPrev = pathData[i - 1];
        let type = com.type;
        let values = com.values;
        let valuesL = values.length;
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let [x, y] = [values[valuesL - 2], values[valuesL - 1]];
        let cp1X, cp1Y, cp2X, cp2Y;
        let [prevX, prevY] = [
            valuesPrev[valuesPrevL - 2],
            valuesPrev[valuesPrevL - 1]
        ];
        let val0R, cpN1XR, val1R, cpN1YR, prevXR, prevYR;

        switch (type) {
            case "L":
                [val0R, prevXR, val1R, prevYR] = [
                    values[0],
                    prevX,
                    values[1],
                    prevY
                ].map((val) => {
                    return +(val * 2).toFixed(1);
                });

                if (prevYR == val1R && prevXR !== val0R) {
                    comShort = {
                        type: "H",
                        values: [values[0]]
                    };
                } else if (prevXR == val0R && prevYR !== val1R) {
                    comShort = {
                        type: "V",
                        values: [values[1]]
                    };
                } else {
                    comShort = com;
                }
                break;
            case "Q":
                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // Q control point
                cpN1X = prevX + (prevX - cp1X);
                cpN1Y = prevY + (prevY - cp1Y);

                // control points can be reflected
                // rounded values for better tolerance
                [val0R, cpN1XR, val1R, cpN1YR] = [
                    values[0],
                    cpN1X,
                    values[1],
                    cpN1Y
                ].map((val) => {
                    return +(val * 1).toFixed(1);
                });
                //console.log(val0R ,cpN1XR , val1R , cpN1YR);

                if (val0R == cpN1XR && val1R == cpN1YR) {
                    comShort = {
                        type: "T",
                        values: [x, y]
                    };
                } else {
                    comShort = com;
                }
                break;
            case "C":
                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [cp2X, cp2Y] =
                    valuesPrevL > 2
                        ? [valuesPrev[2], valuesPrev[3]]
                        : [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // C control points
                cpN1X = 2 * prevX - cp2X;
                cpN1Y = 2 * prevY - cp2Y;
                cpN2X = values[2];
                cpN2Y = values[3];

                // control points can be reflected
                // rounded values for better tolerance
                [val0R, cpN1XR, val1R, cpN1YR] = [
                    values[0],
                    cpN1X,
                    values[1],
                    cpN1Y
                ].map((val) => {
                    return +(val * 3).toFixed(0);
                });

                if (val0R == cpN1XR && val1R == cpN1YR) {
                    comShort = {
                        type: "S",
                        values: [cpN2X, cpN2Y, x, y]
                    };
                } else {
                    comShort = com;
                }
                break;
            default:
                comShort = {
                    type: type,
                    values: values
                };
        }
        pathDataShorts.push(comShort);
    }
    return pathDataShorts;
}

/**
 * dependancy: Jarek Foks's pathdata polyfill
 * cdn: https://cdn.jsdelivr.net/npm/path-data-polyfill@1.0.4/path-data-polyfill.min.js
 * github: https://github.com/jarek-foksa/path-data-polyfill
 * gist: https://gist.github.com/herrstrietzel/1d8c2871436463fe0b4ce5ffaee4d2be
 **/

// convert to relative commands
function pathDataToRelative(pathData, decimals = -1, unlink = false) {
    // remove object reference
    pathData = unlink ? JSON.parse(JSON.stringify(pathData)) : pathData;

    let M = pathData[0].values;
    let x = M[0],
        y = M[1],
        mx = x,
        my = y;
    // loop through commands
    for (let i = 1; i < pathData.length; i++) {
        let cmd = pathData[i];
        let type = cmd.type;
        let typeRel = type.toLowerCase();
        let values = cmd.values;

        // is absolute
        if (type != typeRel) {
            type = typeRel;
            cmd.type = type;
            // check current command types
            switch (typeRel) {
                case "a":
                    values[5] = +(values[5] - x);
                    values[6] = +(values[6] - y);
                    break;
                case "v":
                    values[0] = +(values[0] - y);
                    break;
                case "m":
                    mx = values[0];
                    my = values[1];
                default:
                    // other commands
                    if (values.length) {
                        for (let v = 0; v < values.length; v++) {
                            // even value indices are y coordinates
                            values[v] = values[v] - (v % 2 ? y : x);
                        }
                    }
            }
        }
        // is already relative
        else {
            if (cmd.type == "m") {
                mx = values[0] + x;
                my = values[1] + y;
            }
        }
        let vLen = values.length;
        switch (type) {
            case "z":
                x = mx;
                y = my;
                break;
            case "h":
                x += values[vLen - 1];
                break;
            case "v":
                y += values[vLen - 1];
                break;
            default:
                x += values[vLen - 2];
                y += values[vLen - 1];
        }

        // round coordinates
        if (decimals >= 0) {
            cmd.values = values.map((val) => {
                return +val.toFixed(decimals);
            });
        }
    }
    // round M (starting point)
    if (decimals >= 0) {
        [M[0], M[1]] = [+M[0].toFixed(decimals), +M[1].toFixed(decimals)];
    }
    return pathData;
}

function pathDataToAbsolute(pathData, decimals = -1, unlink = false) {
    // remove object reference
    pathData = unlink ? JSON.parse(JSON.stringify(pathData)) : pathData;

    let M = pathData[0].values;
    let x = M[0],
        y = M[1],
        mx = x,
        my = y;
    // loop through commands
    for (let i = 1; i < pathData.length; i++) {
        let cmd = pathData[i];
        let type = cmd.type;
        let typeAbs = type.toUpperCase();
        let values = cmd.values;

        if (type != typeAbs) {
            type = typeAbs;
            cmd.type = type;
            // check current command types
            switch (typeAbs) {
                case "A":
                    values[5] = +(values[5] + x);
                    values[6] = +(values[6] + y);
                    break;

                case "V":
                    values[0] = +(values[0] + y);
                    break;

                case "H":
                    values[0] = +(values[0] + x);
                    break;

                case "M":
                    mx = +values[0] + x;
                    my = +values[1] + y;

                default:
                    // other commands
                    if (values.length) {
                        for (let v = 0; v < values.length; v++) {
                            // even value indices are y coordinates
                            values[v] = values[v] + (v % 2 ? y : x);
                        }
                    }
            }
        }
        // is already absolute
        let vLen = values.length;
        switch (type) {
            case "Z":
                x = +mx;
                y = +my;
                break;
            case "H":
                x = values[0];
                break;
            case "V":
                y = values[0];
                break;
            case "M":
                mx = values[vLen - 2];
                my = values[vLen - 1];

            default:
                x = values[vLen - 2];
                y = values[vLen - 1];
        }

        // round coordinates
        if (decimals >= 0) {
            cmd.values = values.map((val) => {
                return +val.toFixed(decimals);
            });
        }
    }
    // round M (starting point)
    if (decimals >= 0) {
        [M[0], M[1]] = [+M[0].toFixed(decimals), +M[1].toFixed(decimals)];
    }
    return pathData;
}


/**
 * Add closing lineto:
 * needed for path reversing or adding points
 */
function addClosePathLineto(pathData) {
    let pathDataL = pathData.length;
    let closed = pathData[pathDataL - 1]["type"] == "Z" ? true : false;

    let M = pathData[0];
    let [x0, y0] = [M.values[0], M.values[1]];
    let lastCom = closed ? pathData[pathDataL - 2] : pathData[pathDataL - 1];
    let lastComL = lastCom.values.length;
    let [xE, yE] = [lastCom.values[lastComL - 2], lastCom.values[lastComL - 1]];
    if (closed && (x0 != xE || y0 != yE)) {
        pathData.pop();
        pathData.push(
            {
                type: "L",
                values: [x0, y0]
            },
            {
                type: "Z",
                values: []
            }
        );
    }
    return pathData;
}


/**
 * split compound paths into sub path data array
 */
function splitSubpaths(pathData) {
    let subPathArr = [];
    let subPathMindex = [];
    pathData.forEach((com, i) => {
        let type = com.type;
        if (type == "M") {
            subPathMindex.push(i);
        }
    });
    //split segments after M command
    subPathMindex.forEach((index, i) => {
        let n = subPathMindex[i + 1];
        let thisSeg = pathData.slice(index, n);
        subPathArr.push(thisSeg);
    });
    return subPathArr;
}
