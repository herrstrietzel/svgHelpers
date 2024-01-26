
/**
 * converts all commands to absolute
 * optional: convert shorthands; arcs to cubics 
 */

function convertPathData(pathData, options) {

    // analyze pathdata
    let commandTokens = pathData.map(com => { return com.type }).join('')
    let hasRel = /[astvqmhlc]/g.test(commandTokens);
    let hasShorthands = /[hstv]/gi.test(commandTokens);
    let hasQuadratics = /[qt]/gi.test(commandTokens);
    let hasArcs = /[a]/gi.test(commandTokens);

    // merge default options
    let defaults = {
        toAbsolute: true,
        toRelative: false,
        quadraticToCubic: false,
        cubicToQuadratic: false,
        cubicToQuadraticPrecision: 0.1,
        lineToCubic: false,
        toLonghands: true,
        toShorthands: false,
        arcToCubic: false,
        arcParam: false,
        arcAccuracy: 1,
        decimals: -1,
    }

    options = {
        ...defaults,
        ...options
    }

    let { toAbsolute, toRelative, quadraticToCubic, cubicToQuadratic, cubicToQuadraticPrecision, lineToCubic, toLonghands, toShorthands, arcToCubic, arcParam, arcAccuracy, decimals } = options;

    // nothing to convert – passthrough
    if (!hasRel && !hasShorthands && !hasQuadratics && !hasArcs && !toRelative && !toShorthands) {
        return pathData
    }

    /**
     * convert to absolute
     */

    // add M
    let pathDataAbs = [pathData[0]];
    let lastX = pathData[0].values[0];
    let lastY = pathData[0].values[1];
    let offX = lastX;
    let offY = lastY;


    /**
     * arcToCubic, quadraticToCubic, toLonghands  
     * will force toAbsolute conversion
     */

    if (arcToCubic || toLonghands || quadraticToCubic || cubicToQuadratic || arcParam) {
        toAbsolute = true
    }

    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];
        let { type, values } = com;
        let typeRel = type.toLowerCase();
        let typeAbs = type.toUpperCase();
        let valuesL = values.length;
        let isRelative = type === typeRel;
        let comPrev = pathData[i - 1];
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let p0 = { x: valuesPrev[valuesPrevL - 2], y: valuesPrev[valuesPrevL - 1] };

        if (isRelative && toAbsolute) {
            com.type = typeAbs;
            switch (typeRel) {
                case "a":
                    com.values = [
                        values[0],
                        values[1],
                        values[2],
                        values[3],
                        values[4],
                        values[5] + offX,
                        values[6] + offY
                    ];
                    break;


                case "h":
                case "v":
                    com.values = type === 'h' ? [values[0] + offX] : [values[0] + offY];
                    break;

                case 'm':
                case 'l':
                case 't':
                    com.values = [values[0] + offX, values[1] + offY]
                    break;

                case "c":
                    com.values = [
                        values[0] + offX,
                        values[1] + offY,
                        values[2] + offX,
                        values[3] + offY,
                        values[4] + offX,
                        values[5] + offY
                    ];
                    break;

                case "q":
                case "s":
                    com.values = [
                        values[0] + offX,
                        values[1] + offY,
                        values[2] + offX,
                        values[3] + offY,
                    ];
                    break;
            }
        }
        // is absolute
        else {
            offX = 0;
            offY = 0;
        }

        /**
         * convert shorthands
         */
        if (toLonghands && hasShorthands || (com.type === 'T' && quadraticToCubic)) {
            let cp1X, cp1Y, cpN1X, cpN1Y, cp2X, cp2Y;
            if (com.type === 'H' || com.type === 'V') {
                com.values = com.type === 'H' ? [com.values[0], lastY] : [lastX, com.values[0]];
                com.type = 'L';
            }
            else if (com.type === 'T' || com.type === 'S') {

                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [cp2X, cp2Y] = valuesPrevL > 2 ? [valuesPrev[2], valuesPrev[3]] : [valuesPrev[0], valuesPrev[1]];

                // new control point
                cpN1X = com.type === 'T' ? lastX + (lastX - cp1X) : 2 * lastX - cp2X;
                cpN1Y = com.type === 'T' ? lastY + (lastY - cp1Y) : 2 * lastY - cp2Y;

                com.values = [cpN1X, cpN1Y, com.values].flat();
                com.type = com.type === 'T' ? 'Q' : 'C';
            }
        }

        // convert quadratic to cubic
        if (quadraticToCubic && hasQuadratics && com.type === 'Q') {
            com = quadratic2Cubic(p0, com.values)
        }


        // parametrized arc rx and ry values
        if (arcParam && typeRel === 'a') {
            let arcData = svgArcToCenterParam(lastX, lastY, values[0], values[1], values[2], values[3], values[4], values[5], values[6]);
            console.log(arcData);
            com.values = [arcData.rx, arcData.ry, values[2], values[3], values[4], values[5], values[6]]
        }

        /**
         * linetos to cubic
         * facilitates morphing animations
         */
        if (lineToCubic && com.type === 'L') {
            com = { type: 'C', values: [lastX, lastY, com.values[0], com.values[1], com.values[0], com.values[1]] }
        }

        //convert arcs to cubics
        if (arcToCubic && hasArcs && com.type === 'A') {
            // add all C commands instead of Arc
            let cubicArcs = arcToBezier({ x: lastX, y: lastY }, com.values, arcAccuracy);
            cubicArcs.forEach((cubicArc) => {
                pathDataAbs.push(cubicArc);
            });
        }


        else {
            // add command
            pathDataAbs.push(com)
        }

        // update offsets
        lastX = valuesL > 1 ? values[valuesL - 2] + offX : (typeRel === 'h' ? values[0] + offX : lastX);
        lastY = valuesL > 1 ? values[valuesL - 1] + offY : (typeRel === 'v' ? values[0] + offY : lastY);
        offX = lastX;
        offY = lastY;

    };


    // to quadratic
    if (cubicToQuadratic) {
        pathDataAbs = pathDataToQuadratic(pathDataAbs, cubicToQuadraticPrecision)
    }

    // to shorthands
    if (toShorthands) {
        pathDataAbs = pathDataToShorthands(pathDataAbs, decimals)
    }

    // to Relative
    if (toRelative) {
        pathDataAbs = pathDataToRelative(pathDataAbs, decimals)
    }


    // round if not already rounded
    if (!toShorthands && !toRelative && decimals > -1) {
        pathDataAbs = roundPathData(pathDataAbs, decimals)
    }

    return pathDataAbs;
}




/**
 * convert quadratic commands to cubic
 */
function quadratic2Cubic(p0, com) {
    if (Array.isArray(p0)) {
        p0 = {
            x: p0[0],
            y: p0[1]
        }
    }
    let cp1 = {
        x: p0.x + 2 / 3 * (com[0] - p0.x),
        y: p0.y + 2 / 3 * (com[1] - p0.y)
    }
    let cp2 = {
        x: com[2] + 2 / 3 * (com[0] - com[2]),
        y: com[3] + 2 / 3 * (com[1] - com[3])
    }
    return ({ type: "C", values: [cp1.x, cp1.y, cp2.x, cp2.y, com[2], com[3]] });
}



function roundPathData(pathData, decimals = -1) {
    pathData.forEach((com, c) => {
        if (decimals >= 0) {
            com.values.forEach((val, v) => {
                pathData[c].values[v] = +val.toFixed(decimals);
            });
        }
    });
    return pathData;
}


/**
 * This is just a port of Dmitry Baranovskiy's 
 * pathToRelative/Absolute methods used in snap.svg
 * https://github.com/adobe-webplatform/Snap.svg/
 * 
 * Demo: https://codepen.io/herrstrietzel/pen/poVKbgL
 */

// convert to relative commands
function pathDataToRelative(pathData, decimals = -1) {

    // round coordinates to prevent distortions
    if (decimals >= 0) {
        pathData[0].values = pathData[0].values.map(val => { return +val.toFixed(decimals) })
    }

    let M = pathData[0].values;
    let x = M[0],
        y = M[1],
        mx = x,
        my = y;


    // loop through commands
    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];

        // round coordinates to prevent distortions
        if (decimals >= 0 && com.values.length) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) })
        }
        let { type, values } = com;
        let typeRel = type.toLowerCase();


        // is absolute
        if (type != typeRel) {
            type = typeRel;
            com.type = type;
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
            if (type == "m") {
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
        // round final relative values
        if (decimals > -1) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) })
        }
    }
    return pathData;
}

function pathDataToAbsolute(pathData, decimals = -1) {

    // round coordinates to prevent distortions
    if (decimals >= 0) {
        pathData[0].values = pathData[0].values.map(val => { return +val.toFixed(decimals) })
    }

    let M = pathData[0].values;
    let x = M[0],
        y = M[1],
        mx = x,
        my = y;

    // loop through commands
    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];

        // round coordinates to prevent distortions
        if (decimals >= 0 && com.values.length) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) })
        }

        let { type, values } = com;
        let typeAbs = type.toUpperCase();

        if (type != typeAbs) {
            type = typeAbs;
            com.type = type;
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
        // round final absolute values
        if (decimals > -1) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) })
        }
    }
    return pathData;
}


/**
 * decompose/convert shorthands to "longhand" commands:
 * H, V, S, T => L, L, C, Q
 * reversed method: pathDataToShorthands()
 */

function pathDataToLonghands(pathData, decimals = -1, test = true) {

    // analyze pathdata – if you're sure your data is already absolute skip it via test=false
    let hasRel;

    if (test) {
        let commandTokens = pathData.map(com => { return com.type }).join('')
        let hasShorthands = /[hstv]/gi.test(commandTokens);
        hasRel = /[astvqmhlc]/g.test(commandTokens);

        if (!hasShorthands) {
            return pathData;
        }
    }

    pathData = test && hasRel ? pathDataToAbsolute(pathData, decimals) : pathData;

    let pathDataLonghand = [];
    let comPrev = {
        type: "M",
        values: pathData[0].values
    };
    pathDataLonghand.push(comPrev);

    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];
        let { type, values } = com;
        let valuesL = values.length;
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let [x, y] = [values[valuesL - 2], values[valuesL - 1]];
        let cp1X, cp1Y, cpN1X, cpN1Y, cpN2X, cpN2Y, cp2X, cp2Y;
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
        // round final longhand values
        if (decimals > -1) {
            comPrev.values = comPrev.values.map(val => { return +val.toFixed(decimals) })
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
function pathDataToShorthands(pathData, decimals = -1, test = true) {

    /** 
     * analyze pathdata – if you're sure your data is already absolute skip it via test=false
    */
    let hasRel
    if (test) {
        let commandTokens = pathData.map(com => { return com.type }).join('')
        hasRel = /[astvqmhlc]/g.test(commandTokens);
    }

    pathData = test && hasRel ? pathDataToAbsolute(pathData, decimals) : pathData;
    let comShort = {
        type: "M",
        values: pathData[0].values
    };
    let pathDataShorts = [comShort];
    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];
        let { type, values } = com;
        let valuesL = values.length;
        let comPrev = pathData[i - 1];
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let [x, y] = [values[valuesL - 2], values[valuesL - 1]];
        let cp1X, cp1Y, cp2X, cp2Y;
        let [prevX, prevY] = [
            valuesPrev[valuesPrevL - 2],
            valuesPrev[valuesPrevL - 1]
        ];
        let val0R, cpN1XR, val1R, cpN1YR, cpN1X, cpN1Y, cpN2X, cpN2Y, prevXR, prevYR;

        switch (type) {
            case "L":
                // round coordinates for some tolerance
                [val0R, prevXR, val1R, prevYR] = [
                    values[0],
                    prevX,
                    values[1],
                    prevY
                ].map((val) => {
                    return +(val).toFixed(2);
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
                    return +(val).toFixed(1);
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
                    return +(val).toFixed(1);
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

        // round final values
        if (decimals > -1) {
            comShort.values = comShort.values.map(val => { return +val.toFixed(decimals) })
        }

        pathDataShorts.push(comShort);
    }
    return pathDataShorts;
}



/**
 * based on puzrin's 
 * fontello/cubic2quad
 * https://github.com/fontello/cubic2quad/blob/master/test/cubic2quad.js
 */

function pathDataToQuadratic(pathData, precision = 0.1) {
    let newPathData = [pathData[0]];
    for (let i = 1; i < pathData.length; i++) {
        let comPrev = pathData[i - 1];
        let com = pathData[i];
        let [type, values] = [com.type, com.values];
        let [typePrev, valuesPrev] = [comPrev.type, comPrev.values];
        let valuesPrevL = valuesPrev.length;
        let [xPrev, yPrev] = [
            valuesPrev[valuesPrevL - 2],
            valuesPrev[valuesPrevL - 1]
        ];


        // convert C to Q
        if (type == "C") {

            let quadCommands = cubicToQuad(
                xPrev,
                yPrev,
                values[0],
                values[1],
                values[2],
                values[3],
                values[4],
                values[5],
                precision
            );

            //console.log(quadCommands);

            quadCommands.forEach(comQ => {
                newPathData.push(comQ)
            })


        } else {
            newPathData.push(com);
        }
    }
    return newPathData;
}

function cubicToQuad(x0, y0, cp1x, cp1y, cp2x, cp2y, px, py, precision) {

    const quadSolve = (x0, y0, cp1x) => {
        if (0 === x0)
            return 0 === y0 ? [] : [-cp1x / y0];
        let o = y0 * y0 - 4 * x0 * cp1x;
        if (Math.abs(o) < 1e-16)
            return [-y0 / (2 * x0)];
        if (o < 0)
            return [];
        let r = Math.sqrt(o);
        return [
            (-y0 - r) / (2 * x0),
            (-y0 + r) / (2 * x0)
        ];
    }

    const solveInflections = (x0, y0, cp1x, cp1y, cp2x, cp2y, px, py) => {
        return quadSolve(
            -px * (y0 - 2 * cp1y + cp2y) +
            cp2x * (2 * y0 - 3 * cp1y + py) +
            x0 * (cp1y - 2 * cp2y + py) -
            cp1x * (y0 - 3 * cp2y + 2 * py),
            px * (y0 - cp1y) +
            3 * cp2x * (-y0 + cp1y) +
            cp1x * (2 * y0 - 3 * cp2y + py) -
            x0 * (2 * cp1y - 3 * cp2y + py),
            cp2x * (y0 - cp1y) + x0 * (cp1y - cp2y) + cp1x * (-y0 + cp2y)
        )
            .filter(function (x0) {
                return x0 > 1e-8 && x0 < 1 - 1e-8;
            })
            .sort((x0, y0) => { return x0 - y0 })

    }

    const subdivideCubic = (x0, y0, cp1x, cp1y, cp2x, cp2y, px, py, precision) => {
        let s = 1 - precision, f = x0 * s + cp1x * precision, l = cp1x * s + cp2x * precision, d = cp2x * s + px * precision, h = f * s + l * precision, p = l * s + d * precision, y = h * s + p * precision, P = y0 * s + cp1y * precision, m = cp1y * s + cp2y * precision, x = cp2y * s + py * precision, b = P * s + m * precision, v = m * s + x * precision, w = b * s + v * precision;
        return [
            [x0, y0, f, P, h, b, y, w],
            [y, w, p, v, d, x, px, py]
        ];
    }

    let s = solveInflections(x0, y0, cp1x, cp1y, cp2x, cp2y, px, py);
    let pts
    if (!s.length) {
        //return _cubicToQuad(x0, y0, cp1x, cp1y, cp2x, cp2y, px, py, precision);

        pts = _cubicToQuad(x0, y0, cp1x, cp1y, cp2x, cp2y, px, py, precision);
    } else {

        for (
            var f,
            l,
            d = [],
            h = [x0, y0, cp1x, cp1y, cp2x, cp2y, px, py],
            p = 0, y = 0;
            y < s.length;
            y++
        ) {
            // subdivide the cubic bezier curve
            l = subdivideCubic(
                h[0],
                h[1],
                h[2],
                h[3],
                h[4],
                h[5],
                h[6],
                h[7],
                1 - (1 - s[y]) / (1 - p)
            );

            // compute the quadratic Bezier curve using the divided cubic segment
            f = _cubicToQuad(
                l[0][0],
                l[0][1],
                l[0][2],
                l[0][3],
                l[0][4],
                l[0][5],
                l[0][6],
                l[0][7],
                precision
            );

            d = d.concat(f.slice(0, -2));
            h = l[1];
            p = s[y];
        }

        // compute the quadratic Bezier curve using the cubic control points
        f = _cubicToQuad(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], precision);
        pts = d.concat(f);
    }

    //  return pathdata commands
    let commands = [];
    for (let j = 2; j < pts.length; j += 4) {
        commands.push({
            type: "Q",
            values: [pts[j], pts[j + 1], pts[j + 2], pts[j + 3]]
        });
    }

    return commands;
}



function _cubicToQuad(x0, y0, cp1x, cp1y, cp2x, cp2y, px, py, c = 0.1) {

    const calcPowerCoefficients = (p0, cp1, cp2, p) => {
        return [
            {
                x: (p.x - p0.x) + (cp1.x - cp2.x) * 3,
                y: (p.y - p0.y) + (cp1.y - cp2.y) * 3
            },
            {
                x: (p0.x + cp2.x) * 3 - cp1.x * 6,
                y: (p0.y + cp2.y) * 3 - cp1.y * 6
            },
            {
                x: (cp1.x - p0.x) * 3,
                y: (cp1.y - p0.y) * 3
            },
            p0
        ];
    }

    const isApproximationClose = (p0, cp1, cp2, p, pointArr, precision) => {

        for (let u = 1 / pointArr.length, a = 0; a < pointArr.length; a++) {
            if (!isSegmentApproximationClose(p0, cp1, cp2, p, a * u, (a + 1) * u, pointArr[a][0], pointArr[a][1], pointArr[a][2], precision)) {
                return false;
            }
        }
        return true;
    }

    const calcPoint = (p0, cp1, cp2, p, t) => {
        return {
            x: ((p0.x * t + cp1.x) * t + cp2.x) * t + p.x,
            y: ((p0.y * t + cp1.y) * t + cp2.y) * t + p.y,
        };
    }

    const calcPointQuad = (p0, cp1, p, t) => {
        return {
            x: ((p0.x * t + cp1.x) * t) + p.x,
            y: ((p0.y * t + cp1.y) * t) + p.y,
        }
    }

    const calcPointDerivative = (p0, cp1, p, k, t) => {
        return {
            x: ((p0.x * 3 * t + cp1.x * 2) * t) + p.x,
            y: ((p0.y * 3 * t + cp1.y * 2) * t) + p.y,
        }
    }

    const processSegment = (p0, cp1, cp2, p, t1, t2) => {

        var u = calcPoint(p0, cp1, cp2, p, t1),
            a = calcPoint(p0, cp1, cp2, p, t2),
            c = calcPointDerivative(p0, cp1, cp2, p, t1),
            s = calcPointDerivative(p0, cp1, cp2, p, t2),
            f = -c.x * s.y + s.x * c.y;

        return Math.abs(f) < 1e-8 ? [
            u,
            {
                x: (u.x + a.x) / 2,
                y: (u.y + a.y) / 2
            },
            a
        ]
            : [
                u,
                {
                    x: (c.x * (a.y * s.x - a.x * s.y) + s.x * (u.x * c.y - u.y * c.x)) / f,
                    y: (c.y * (a.y * s.x - a.x * s.y) + s.y * (u.x * c.y - u.y * c.x)) / f
                },
                a
            ];
    }

    const isSegmentApproximationClose = (p0, cp1, cp2, p, t1, t2, px, py, c, precision) => {

        const calcPowerCoefficientsQuad = (p0, cp1, p) => {
            return [
                { x: cp1.x * -2 + p0.x + p.x, y: cp1.y * -2 + p0.y + p.y },
                { x: (cp1.x - p0.x) * 2, y: (cp1.y - p0.y) * 2, }, p0
            ]
        }

        const minDistanceToLineSq = (p0, cp1, p) => {
            let o = { x: (p.x - cp1.x), y: (p.y - cp1.y), }
            let r = (p0.x - cp1.x) * o.x + (p0.y - cp1.y) * o.y;
            let e = o.x * o.x + o.y * o.y;
            let result = 0;

            if (e != 0) {
                result = r / e
            }
            if (result <= 0) {
                result = Math.pow((p0.x - cp1.x), 2) + Math.pow((p0.y - cp1.y), 2);
            } else if (result >= 1) {
                result = Math.pow((p0.x - p.x), 2) + Math.pow((p0.y - p.y), 2)
            } else {
                result = Math.pow((p0.x - (cp1.x + o.x * result)), 2) + Math.pow((p0.y - (cp1.y + o.y * result)), 2);
            }

            return result
        }

        let l, d, h, p2, y,
            P = calcPowerCoefficientsQuad(px, py, c),
            m = P[0],
            x = P[1],
            b = P[2],
            v = precision * precision,
            w = [],
            g = [];

        for (l = (t2 - t1) / 10, d = 0, t = t1; d <= 10; d++, t += l) {
            w.push(calcPoint(p0, cp1, cp2, p, t))
        }
        for (l = 0.1, d = 0, t = 0; d <= 10; d++, t += l) {
            g.push(calcPointQuad(m, x, b, t))
        }
        for (d = 1; d < w.length - 1; d++) {
            for (y = 1 / 0, h = 0; h < g.length - 1; h++) {
                p2 = minDistanceToLineSq(w[d], g[h], g[h + 1]), y = Math.min(y, p2)
            }
            if (y > v) {
                return false;
            }
        }
        for (d = 1; d < g.length - 1; d++) {
            for (y = 1 / 0, h = 0; h < w.length - 1; h++)
                p2 = minDistanceToLineSq(g[d], w[h], w[h + 1]), y = Math.min(y, p2);
            if (y > v)
                return false;
        }
        return true;
    }


    for (
        f = { x: x0, y: y0 },
        l = { x: cp1x, y: cp1y },
        d = { x: cp2x, y: cp2y },
        h = { x: px, y: py },
        p = calcPowerCoefficients(f, l, d, h),
        y = p[0],
        P = p[1],
        m = p[2], x = p[3],
        b = 1; b <= 8; b++) {
        s = [];
        for (let v = 0; v < 1; v += 1 / b) {
            s.push(processSegment(y, P, m, x, v, v + 1 / b));
        }

        let b1 = ((s[0][1].x - f.x) * (l.x - f.x)) + ((s[0][1].y - f.y) * (l.y - f.y))
        let b2 = ((s[0][1].x - h.x) * (d.x - h.x)) + ((s[0][1].y - h.y) * (d.y - h.y))

        if (
            (1 !== b || !(b1 < 0 || b2 < 0)) &&
            isApproximationClose(y, P, m, x, s, c)
        ) {
            break;
        }

    }

    //return pts;
    let pts = [s[0][0].x, s[0][0].y];
    for (let i = 0; i < s.length; i++) {
        pts.push(s[i][1].x, s[i][1].y, s[i][2].x, s[i][2].y)
    }

    return pts

}



/** 
 * convert arctocommands to cubic bezier
 * based on puzrin's a2c.js
 * https://github.com/fontello/svgpath/blob/master/lib/a2c.js
 * returns pathData array
*/

function arcToBezier(p0, values, splitSegments = 1) {
    const TAU = Math.PI * 2;
    let [rx, ry, rotation, largeArcFlag, sweepFlag, x, y] = values;

    if (rx === 0 || ry === 0) {
        return []
    }

    let phi = rotation ? rotation * TAU / 360 : 0;
    let sinphi = phi ? Math.sin(phi) : 0
    let cosphi = phi ? Math.cos(phi) : 1
    let pxp = cosphi * (p0.x - x) / 2 + sinphi * (p0.y - y) / 2
    let pyp = -sinphi * (p0.x - x) / 2 + cosphi * (p0.y - y) / 2

    if (pxp === 0 && pyp === 0) {
        return []
    }
    rx = Math.abs(rx)
    ry = Math.abs(ry)
    let lambda =
        pxp * pxp / (rx * rx) +
        pyp * pyp / (ry * ry)
    if (lambda > 1) {
        let lambdaRt = Math.sqrt(lambda);
        rx *= lambdaRt
        ry *= lambdaRt
    }

    /** 
     * parametrize arc to 
     * get center point start and end angles
     */
    let rxsq = rx * rx,
        rysq = rx === ry ? rxsq : ry * ry

    let pxpsq = pxp * pxp,
        pypsq = pyp * pyp
    let radicant = (rxsq * rysq) - (rxsq * pypsq) - (rysq * pxpsq)

    if (radicant <= 0) {
        radicant = 0
    } else {
        radicant /= (rxsq * pypsq) + (rysq * pxpsq)
        radicant = Math.sqrt(radicant) * (largeArcFlag === sweepFlag ? -1 : 1)
    }

    let centerxp = radicant ? radicant * rx / ry * pyp : 0
    let centeryp = radicant ? radicant * -ry / rx * pxp : 0
    let centerx = cosphi * centerxp - sinphi * centeryp + (p0.x + x) / 2
    let centery = sinphi * centerxp + cosphi * centeryp + (p0.y + y) / 2

    let vx1 = (pxp - centerxp) / rx
    let vy1 = (pyp - centeryp) / ry
    let vx2 = (-pxp - centerxp) / rx
    let vy2 = (-pyp - centeryp) / ry

    // get start and end angle
    const vectorAngle = (ux, uy, vx, vy) => {
        let dot = +(ux * vx + uy * vy).toFixed(9)
        if (dot === 1 || dot === -1) {
            return dot === 1 ? 0 : Math.PI
        }
        dot = dot > 1 ? 1 : (dot < -1 ? -1 : dot)
        let sign = (ux * vy - uy * vx < 0) ? -1 : 1
        return sign * Math.acos(dot);
    }

    let ang1 = vectorAngle(1, 0, vx1, vy1),
        ang2 = vectorAngle(vx1, vy1, vx2, vy2)

    if (sweepFlag === 0 && ang2 > 0) {
        ang2 -= Math.PI * 2
    }
    else if (sweepFlag === 1 && ang2 < 0) {
        ang2 += Math.PI * 2
    }

    let ratio = +(Math.abs(ang2) / (TAU / 4)).toFixed(0)

    // increase segments for more accureate length calculations
    let segments = ratio * splitSegments;
    ang2 /= segments
    let pathDataArc = [];


    // If 90 degree circular arc, use a constant
    // https://pomax.github.io/bezierinfo/#circles_cubic
    // k=0.551784777779014
    const angle90 = 1.5707963267948966;
    const k = 0.551785
    let a = ang2 === angle90 ? k :
        (
            ang2 === -angle90 ? -k : 4 / 3 * Math.tan(ang2 / 4)
        );

    let cos2 = ang2 ? Math.cos(ang2) : 1;
    let sin2 = ang2 ? Math.sin(ang2) : 0;
    let type = 'C'

    const approxUnitArc = (ang1, ang2, a, cos2, sin2) => {
        let x1 = ang1 != ang2 ? Math.cos(ang1) : cos2;
        let y1 = ang1 != ang2 ? Math.sin(ang1) : sin2;
        let x2 = Math.cos(ang1 + ang2);
        let y2 = Math.sin(ang1 + ang2);

        return [
            { x: x1 - y1 * a, y: y1 + x1 * a },
            { x: x2 + y2 * a, y: y2 - x2 * a },
            { x: x2, y: y2 }
        ];
    }

    for (let i = 0; i < segments; i++) {
        let com = { type: type, values: [] }
        let curve = approxUnitArc(ang1, ang2, a, cos2, sin2);

        curve.forEach((pt) => {
            let x = pt.x * rx
            let y = pt.y * ry
            com.values.push(cosphi * x - sinphi * y + centerx, sinphi * x + cosphi * y + centery)
        })
        pathDataArc.push(com);
        ang1 += ang2
    }

    return pathDataArc;
}


/**
 * add readable command point data 
 * to pathData command objects
 */
function pathDataToVerbose(pathData) {

    let pathDataOriginal = JSON.parse(JSON.stringify(pathData))

    // normalize
    pathData = pathDataToLonghands(pathDataToAbsolute(pathData));

    let pathDataVerbose = [];
    let pathDataL = pathData.length;
    let closed = pathData[pathDataL - 1].type.toLowerCase() === 'z' ? true : false;

    pathData.forEach((com, i) => {
        let {
            type,
            values
        } = com;

        let comO = pathDataOriginal[i];
        let typeO = comO.type;
        let valuesO = comO.values;

        let typeLc = typeO.toLowerCase();
        let valuesL = values.length;
        let isRel = typeO === typeO.toLowerCase();

        let comPrev = pathData[i - 1] ? pathData[i - 1] : false;
        let comPrevValues = comPrev ? comPrev.values : [];
        let comPrevValuesL = comPrevValues.length;


        let p0 = {
            x: comPrevValues[comPrevValuesL - 2],
            y: comPrevValues[comPrevValuesL - 1]
        }

        let p = valuesL ? {
            x: values[valuesL - 2],
            y: values[valuesL - 1]
        } : (i === pathData.length - 1 && closed ? pathData[0].values : false);



        let comObj = {
            type: typeO,
            values: valuesO,
            typeNorm: type,
            valuesNorm: values,
            p: p,
            isRelative: isRel
        }
        if (comPrevValuesL) {
            comObj.p0 = p0
        }
        switch (typeLc) {
            case 'q':
                comObj.cp1 = {
                    x: values[valuesL - 4],
                    y: values[valuesL - 3]
                }
                break;
            case 'c':
                comObj.cp1 = {
                    x: values[valuesL - 6],
                    y: values[valuesL - 5]
                }
                comObj.cp2 = {
                    x: values[valuesL - 4],
                    y: values[valuesL - 3]
                }
                break;
            case 'a':

                // parametrized arc rx and ry values
                let arcData = svgArcToCenterParam(p0.x, p0.y, values[0], values[1], values[2], values[3], values[4], values[5], values[6]);

                comObj.rx = arcData.rx
                comObj.ry = arcData.ry
                comObj.xAxisRotation = values[2]
                comObj.largeArcFlag = values[3]
                comObj.sweepFlag = values[4]
                comObj.startAngle = arcData.startAngle
                comObj.endAngle = arcData.endAngle
                comObj.deltaAngle = arcData.deltaAngle
                break;
        }
        pathDataVerbose.push(comObj);
    });
    return pathDataVerbose;
}

/**
* convert pathData nested array notation
* as used in snap and other libraries
*/
function convertArrayPathData(pathDataSnap) {
    let pathData = [];
    pathDataSnap.forEach(com => {
        let type = com.shift();
        pathData.push({
            type: type,
            values: com
        })
    })
    return pathData;
}

function revertPathDataToArray(pathData) {
    let pathDataSnap = [];
    pathData.forEach(com => {
        pathDataSnap.push([com.type, com.values].flat())
    })
    return pathDataSnap;
}



/**
* parmetrize path arcto commands
* based on @cuixiping;
* https://stackoverflow.com/questions/9017100/calculate-center-of-svg-arc/12329083#12329083
*/

function svgArcToCenterParam(p0x, p0y, rx, ry, angle, largeArc, sweep, px, py) {

    const radian = (ux, uy, vx, vy) => {
        let dot = ux * vx + uy * vy;
        let mod = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
        let rad = Math.acos(dot / mod);
        if (ux * vy - uy * vx < 0) {
            rad = -rad;
        }
        return rad;
    };
    // degree to radian
    let phi = (+angle * Math.PI) / 180;
    let cx, cy, startAngle, deltaAngle, endAngle;
    let PI = Math.PI;
    let PIpx = PI * 2;
    if (rx < 0) {
        rx = -rx;
    }
    if (ry < 0) {
        ry = -ry;
    }
    if (rx == 0 || ry == 0) {
        // invalid arguments
        throw Error("rx and ry can not be 0");
    }
    let s_phi = Math.sin(phi);
    let c_phi = Math.cos(phi);
    let hd_x = (p0x - px) / 2; // half diff of x
    let hd_y = (p0y - py) / 2; // half diff of y
    let hs_x = (p0x + px) / 2; // half sum of x
    let hs_y = (p0y + py) / 2; // half sum of y
    // F6.5.1
    let p0x_ = c_phi * hd_x + s_phi * hd_y;
    let p0y_ = c_phi * hd_y - s_phi * hd_x;
    // F.6.6 Correction of out-of-range radii
    //   Step 3: Ensure radii are large enough
    let lambda = (p0x_ * p0x_) / (rx * rx) + (p0y_ * p0y_) / (ry * ry);
    if (lambda > 1) {
        rx = rx * Math.sqrt(lambda);
        ry = ry * Math.sqrt(lambda);
    }
    let rxry = rx * ry;
    let rxp0y_ = rx * p0y_;
    let ryp0x_ = ry * p0x_;
    let sum_of_sq = rxp0y_ * rxp0y_ + ryp0x_ * ryp0x_; // sum of square
    if (!sum_of_sq) {
        throw Error("start point can not be same as end point");
    }
    let coe = Math.sqrt(Math.abs((rxry * rxry - sum_of_sq) / sum_of_sq));
    if (largeArc == sweep) {
        coe = -coe;
    }
    // F6.5.2
    let cx_ = (coe * rxp0y_) / ry;
    let cy_ = (-coe * ryp0x_) / rx;
    // F6.5.3
    cx = c_phi * cx_ - s_phi * cy_ + hs_x;
    cy = s_phi * cx_ + c_phi * cy_ + hs_y;
    let xcr1 = (p0x_ - cx_) / rx;
    let xcr2 = (p0x_ + cx_) / rx;
    let ycr1 = (p0y_ - cy_) / ry;
    let ycr2 = (p0y_ + cy_) / ry;
    // F6.5.5
    startAngle = radian(1, 0, xcr1, ycr1);
    // F6.5.6
    deltaAngle = radian(xcr1, ycr1, -xcr2, -ycr2);
    if (deltaAngle > PIpx) {
        deltaAngle -= PIpx;
    }
    else if (deltaAngle < 0) {
        deltaAngle += PIpx;
    }
    if (sweep == false || sweep == 0) {
        deltaAngle -= PIpx;
    }
    endAngle = startAngle + deltaAngle;
    if (endAngle > PIpx) {
        endAngle -= PIpx;
    }
    else if (endAngle < 0) {
        endAngle += PIpx;
    }
    let toDegFactor = 180 / PI;
    let outputObj = {
        pt: {
            x: cx,
            y: cy
        },
        rx: rx,
        ry: ry,
        startAngle_deg: startAngle * toDegFactor,
        startAngle: startAngle,
        deltaAngle_deg: deltaAngle * toDegFactor,
        deltaAngle: deltaAngle,
        endAngle_deg: endAngle * toDegFactor,
        endAngle: endAngle,
        clockwise: sweep == true || sweep == 1
    };
    return outputObj;
}

