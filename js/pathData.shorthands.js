
/**
 * decompose/convert shorthands to "longhand" commands:
 * H, V, S, T => L, L, C, Q
 * reversed method: pathDataToShorthands()
 */
function pathDataToLonghands(pathData, decimals = -1) {
    pathData = pathDataToAbsolute(pathData, decimals);
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
                    valuesPrevL > 2 ?
                        [valuesPrev[2], valuesPrev[3]] :
                        [valuesPrev[0], valuesPrev[1]];
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
    pathData = pathDataToAbsolute(pathData);
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

                /**
                * control points can be reflected
                * use rounded values for better tolerance
                */
                [val0R, cpN1XR, val1R, cpN1YR] = [
                    values[0],
                    cpN1X,
                    values[1],
                    cpN1Y
                ].map((val) => {
                    return +(val * 1).toFixed(1);
                });

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
                    valuesPrevL > 2 ?
                        [valuesPrev[2], valuesPrev[3]] :
                        [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // C control points
                cpN1X = 2 * prevX - cp2X;
                cpN1Y = 2 * prevY - cp2Y;
                cpN2X = values[2];
                cpN2Y = values[3];

                /**
                * control points can be reflected
                * use rounded values for better tolerance
                */
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