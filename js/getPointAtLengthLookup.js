/**
* calculate point at Length 
* from length at t lookup
*/

function getPointAtLengthLookup(pathLengthLookup, length) {
    let { segments, totalLength } = pathLengthLookup;
    let foundSegment = false;
    let pt = { x: 0, y: 0 };
    let newT = 0;

    // first point
    if (length === 0) {
        return segments[0].points[0];
    }

    // last point on path
    if (length.toFixed(3) == totalLength.toFixed(3)) {
        let { points } = segments[segments.length - 1];
        pt = points[points.length - 1];
        return pt;
    }

    //loop through segments
    for (let i = 0; i < segments.length && !foundSegment; i++) {
        let segment = segments[i];
        let { type, lengths, points, total } = segment;
        let end = lengths[lengths.length - 1];
        let tStep = 1 / (lengths.length - 1);

        // find path segment
        if (end > length) {
            foundSegment = true;
            let foundT = false;
            let diffLength;

            switch (type) {
                case 'L':
                    diffLength = end - length;
                    newT = 1 - (1 / total) * diffLength;
                    pt = interpolatedPoint(points[0], points[1], newT);
                    break;

                case 'C':
                case 'Q':
                    /**
                     *  cubic or quadratic beziers
                    */
                    let l1 = getLineLength(points[0], points[1]) + getLineLength(points[1], points[2]);
                    let l2 = type === 'C' ? getLineLength(points[2], points[3]) : 0;
                    let lBase = getLineLength(points[0], points[points.length - 1]);

                    // is flat
                    if (l1 + l2 === lBase) {
                        diffLength = end - length;
                        newT = 1 - (1 / total) * diffLength;
                        pt = newT <= 1 ? interpolatedPoint(points[0], points[2], newT) : points[points.length - 1];
                    }

                    // is curve
                    else {
                        for (let i = 0; i < lengths.length && !foundT; i++) {
                            let lengthAtT = lengths[i];
                            let lengthAtTPrev = i > 0 ? lengths[i - 1] : lengths[i];
                            // found length at t range
                            if (lengthAtT > length) {
                                let t = tStep * i;
                                // length between previous and current t
                                let tSegLength = lengthAtT - lengthAtTPrev;
                                // difference between length at t and exact length
                                let diffLength = lengthAtT - length;
                                // ratio between segment length and difference
                                let tScale = (1 / tSegLength) * diffLength;
                                newT = t - tStep * tScale;
                                foundT = true;

                                // calculate point
                                pt = type === 'C' ? getPointAtCubicSegmentT(points[0], points[1], points[2], points[3], newT) : getPointAtQuadraticSegmentT(points[0], points[1], points[2], newT);

                            }
                        }

                    }
                    break;
            }
        }
    }
    return pt;
}

function getPAthLengthLookup(d, tDivisions = 10) {
    // get pathdata
    let pathData = getPathDataNorm(d);
    let pathLength = 0;
    let M = pathData[0];
    let lengthLookup = { totalLength: 0, segments: [] };

    //let off = 0;
    for (let i = 1; i < pathData.length; i++) {
        let comPrev = pathData[i - 1];
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let p0 = { x: valuesPrev[valuesPrevL - 2], y: valuesPrev[valuesPrevL - 1] };

        let com = pathData[i];
        let { type, values } = com;
        let valuesL = values.length;
        let p = { x: values[valuesL - 2], y: values[valuesL - 1] };
        let len, cp1, cp2, t;

        // collect segment data in object
        if (type !== "M") {
        }
        let lengthObj = {
            lengths: [],
            points: [],
            total: 0,
            type: type
        };

        // interpret closePath as lineto
        switch (type) {
            case "M":
                // new M
                M = pathData[i];
                len = 0;
                break;

            case "Z":
                // line to previous M
                p = { x: M.values[0], y: M.values[1] };
                len = getLineLength(p0, p);
                lengthObj.type = "L";
                lengthObj.points.push(p0, p);
                break;

            case "L":
                len = getLineLength(p0, p);
                lengthObj.points.push(p0, p);
                break;

            case "C":
            case "Q":
                lengthObj.lengths.push(pathLength);
                cp1 = { x: values[0], y: values[1] };
                cp2 = type === 'C' ? { x: values[2], y: values[3] } : cp1;
                len = type === 'C' ? cubicBezierLength(p0, cp1, cp2, p, 1) : quadraticBezierLength(p0, cp1, p, 1);
                let points = type === 'C' ? [p0, cp1, cp2, p] : [p0, cp1, p];

                for (let d = 1; d < tDivisions; d++) {
                    t = (1 / tDivisions) * d;
                    let bezierLength = type === 'C' ?
                        cubicBezierLength(p0, cp1, cp2, p, t) :
                        quadraticBezierLength(p0, cp1, p, t);
                    //lengthObj.lengths.push( +(bezierLength + pathLength).toFixed(3) );
                    lengthObj.lengths.push((bezierLength + pathLength));
                }
                lengthObj.points = points;
                break;
            default:
                len = 0;
                break;
        }

        lengthObj.lengths.push(len + pathLength);
        lengthObj.total = len;
        pathLength += len;

        if (type !== "M" && type !== "A") {

            lengthLookup.segments.push(lengthObj);
        }
        lengthLookup.totalLength = pathLength;
    }
    return lengthLookup;
}

/**
 * Based on snap.svg bezlen() function
 * https://github.com/adobe-webplatform/Snap.svg/blob/master/dist/snap.svg.js#L5786
 */
function cubicBezierLength(p0, cp1, cp2, p, t = 1) {
    if (t === 0) {
        return 0;
    }
    const base3 = (t, p1, p2, p3, p4) => {
        let t1 = -3 * p1 + 9 * p2 - 9 * p3 + 3 * p4,
            t2 = t * t1 + 6 * p1 - 12 * p2 + 6 * p3;
        return t * t2 - 3 * p1 + 3 * p2;
    }
    t = t > 1 ? 1 : t < 0 ? 0 : t;
    let t2 = t / 2;
    let Tvalues = [-.1252, .1252, -.3678, .3678, -.5873, .5873, -.7699, .7699, -.9041, .9041, -.9816, .9816];
    let Cvalues = [0.2491, 0.2491, 0.2335, 0.2335, 0.2032, 0.2032, 0.1601, 0.1601, 0.1069, 0.1069, 0.0472, 0.0472];
    let n = Tvalues.length;
    let sum = 0;
    for (let i = 0; i < n; i++) {
        let ct = t2 * Tvalues[i] + t2,
            xbase = base3(ct, p0.x, cp1.x, cp2.x, p.x),
            ybase = base3(ct, p0.y, cp1.y, cp2.y, p.y),
            comb = xbase * xbase + ybase * ybase;
        sum += Cvalues[i] * Math.sqrt(comb);
    }
    return t2 * sum;
}

function quadraticBezierLength(p0, cp1, p, t = 1) {
    if (t === 0) {
        return 0;
    }

    const interpolate = (p1, p2, t) => {
        let pt = { x: (p2.x - p1.x) * t + p1.x, y: (p2.y - p1.y) * t + p1.y };
        return pt;
    }
    const getLineLength = (p1, p2) => {
        return Math.sqrt(
            (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y)
        );
    }

    // is flat/linear 
    let l1 = getLineLength(p0, cp1) + getLineLength(cp1, p);
    let l2 = getLineLength(p0, p);
    if (l1 === l2) {
        let m1 = interpolate(p0, cp1, t);
        let m2 = interpolate(cp1, p, t);
        p = interpolate(m1, m2, t);
        let lengthL;
        lengthL = Math.sqrt((p.x - p0.x) * (p.x - p0.x) + (p.y - p0.y) * (p.y - p0.y));
        return lengthL;
    }

    let a, b, c, d, e, e1, d1, v1x, v1y;
    v1x = cp1.x * 2;
    v1y = cp1.y * 2;
    d = p0.x - v1x + p.x;
    d1 = p0.y - v1y + p.y;
    e = v1x - 2 * p0.x;
    e1 = v1y - 2 * p0.y;
    a = 4 * (d * d + d1 * d1);
    b = 4 * (d * e + d1 * e1);
    c = e * e + e1 * e1;

    const bt = b / (2 * a),
        ct = c / a,
        ut = t + bt,
        k = ct - bt ** 2;

    return (
        (Math.sqrt(a) / 2) *
        (ut * Math.sqrt(ut ** 2 + k) -
            bt * Math.sqrt(bt ** 2 + k) +
            k *
            Math.log((ut + Math.sqrt(ut ** 2 + k)) / (bt + Math.sqrt(bt ** 2 + k))))
    );
}

function getLineLength(p1, p2) {
    return Math.sqrt(
        (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y)
    );
}

/**
 * Linear  interpolation (LERP) helper
 */
function interpolatedPoint(p1, p2, t = 0.5) {
    //t: 0.5 - point in the middle
    if (Array.isArray(p1)) {
        p1.x = p1[0];
        p1.y = p1[1];
    }
    if (Array.isArray(p2)) {
        p2.x = p2[0];
        p2.y = p2[1];
    }
    let [x, y] = [(p2.x - p1.x) * t + p1.x, (p2.y - p1.y) * t + p1.y];
    return {
        x: x,
        y: y
    };
}

/**
 * calculate single points on segments
 */
function getPointAtCubicSegmentT(p0, cp1, cp2, p, t = 0.5) {
    let t1 = 1 - t;
    return {
        x:
            t1 ** 3 * p0.x +
            3 * t1 ** 2 * t * cp1.x +
            3 * t1 * t ** 2 * cp2.x +
            t ** 3 * p.x,
        y:
            t1 ** 3 * p0.y +
            3 * t1 ** 2 * t * cp1.y +
            3 * t1 * t ** 2 * cp2.y +
            t ** 3 * p.y
    };
}

function getPointAtQuadraticSegmentT(p0, cp1, p, t = 0.5) {
    let t1 = 1 - t;
    return {
        x: t1 * t1 * p0.x + 2 * t1 * t * cp1.x + t ** 2 * p.x,
        y: t1 * t1 * p0.y + 2 * t1 * t * cp1.y + t ** 2 * p.y
    };
}

/**
 * parse pathdata normalized
 */
function getPathDataNorm(d) {
    let hasRel = /[astvzqmhlc]/g.test(d);
    let hasShorthands = /[hstv]/gi.test(d);
    let hasArcsOrQuadratic = /[aqt]/gi.test(d);
    let pathData = getPathData(d);
    if (hasRel) {
        pathData = pathDataToAbsolute(pathData);
    }
    if (hasShorthands) {
        pathData = pathDataToLonghands(pathData);
    }

    if (hasArcsOrQuadratic) {
        pathData = pathDataToCubic(pathData, false);
    }
    return pathData;
}

/**
 * normalize to all absolute, cubic, no shorthand
 */
function pathDataToCubic(pathData, convertQuadratic = true) {
    let pathDataNorm = [];
    pathData.forEach((com, i) => {
        let [type, values] = [com.type, com.values];
        let comPrev = i > 0 ? pathData[i - 1] : pathData[i];
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let p0 = {
            x: valuesPrev[valuesPrevL - 2],
            y: valuesPrev[valuesPrevL - 1]
        };
        // convert arc to cubics
        if (type === "A") {
            let cubicArcs = arcCommandToBezier(p0, values);
            cubicArcs.forEach((cubicArc) => {
                pathDataNorm.push(cubicArc);
            });
        }

        else if (type === "Q" && convertQuadratic) {
            pathDataNorm.push(pathDataQuadratic2Cubic(p0, values));
        }

        else {
            pathDataNorm.push(com);
        }
    });
    return pathDataNorm;
}

/**
 * Based on: jkroso/parse-svg-path
 * https://github.com/jkroso/parse-svg-path
 * parse an svg path data string. Generates an Array
 * of commands where each command is an Array of the
 * form `{type:command, values:[]}`
 */
function getPathData(d) {

    var segment = /([astvzqmhlc])([^astvzqmhlc]*)/ig
    var length = { a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0 }
    let number = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/ig

    function parseValues(args) {
        var numbers = args.match(number)
        return numbers ? numbers.map(Number) : []
    }

    let pathData = [];

    d.replace(segment, function (_, command, args) {
        var type = command.toLowerCase()
        args = parseValues(args)

        // overloaded moveTo
        if (type == 'm' && args.length > 2) {
            pathData.push({ type: command, values: args.splice(0, 2) })
            type = 'l'
            command = command == 'm' ? 'l' : 'L'
        }

        while (true) {

            /**
             * long arc and sweep flags 
             * are boolean and can be concatenated like
             * 11 or 01
             */
            if (type === 'a' && args.length < length[type]) {
                let flagArr = args[3].toString().split("");
                args = [args[0], args[1], args[2], +flagArr[0], +flagArr[1], args[4], args[5]];
            }

            if (args.length == length[type]) {
                let values = args.splice(0, length[type]);
                return pathData.push({ type: command, values: values })
            }

            // still too few values
            if (args.length < length[type]) {
                throw new Error('malformed path data')
            }

            pathData.push({ type: command, values: args.splice(0, length[type]) })
        }
    })
    return pathData
}


/**
 * This is a port of Dmitry Baranovskiy's 
 * pathToAbsolute method used in snap.svg
 * https://github.com/adobe-webplatform/Snap.svg/
 */
function pathDataToAbsolute(pathData, decimals = -1) {
    let M = pathData[0].values;
    let x = M[0],
        y = M[1],
        mx = x,
        my = y;
    // loop through commands
    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];
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
    }
    // round coordinates
    if (decimals >= 0) {
        pathData = roundPathData(pathData, decimals);
    }
    return pathData;
}

/**
 * decompose/convert shorthands to "longhand" commands:
 * H, V, S, T => L, L, C, Q
 */
function pathDataToLonghands(pathData) {
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
* convert Arcs to quadratic
* or cubic beziers
* recommended angle threshhold for quadratic: 22.5
*/
function arcCommandToBezier(p0, comValues, quadratic = false, angleThresh = 90, recursive = false) {
    let [r1, r2, angle, largeArcFlag, sweepFlag, x2, y2] = comValues;
    let [x1, y1] = [p0.x, p0.y];
    const interpolate = (p1x, p1y, p2x, p2y, t) => {
        let pt = {
            x: (p2x - p1x) * t + p1x,
            y: (p2y - p1y) * t + p1y
        };
        return pt
    }
    const degToRad = (degrees) => {
        return (Math.PI * degrees) / 180;
    };
    const rotate = (x, y, angleRad) => {
        let X = x * Math.cos(angleRad) - y * Math.sin(angleRad);
        let Y = x * Math.sin(angleRad) + y * Math.cos(angleRad);
        return {
            x: X,
            y: Y
        };
    };
    let angleRad = degToRad(angle);
    let params = [];
    let x, y, f1, f2, cx, cy, h;
    if (recursive) {
        f1 = recursive[0];
        f2 = recursive[1];
        cx = recursive[2];
        cy = recursive[3];
    } else {
        let p1 = rotate(x1, y1, -angleRad);
        x1 = p1.x;
        y1 = p1.y;
        let p2 = rotate(x2, y2, -angleRad);
        x2 = p2.x;
        y2 = p2.y;
        x = (x1 - x2) / 2;
        y = (y1 - y2) / 2;
        h = (x * x) / (r1 * r1) + (y * y) / (r2 * r2);
        if (h > 1) {
            h = Math.sqrt(h);
            r1 = h * r1;
            r2 = h * r2;
        }
        let sign = largeArcFlag === sweepFlag ? -1 : 1;
        let r1Pow = r1 * r1;
        let r2Pow = r2 * r2;
        let left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
        let right = r1Pow * y * y + r2Pow * x * x;
        let k = sign * Math.sqrt(Math.abs(left / right));
        cx = (k * r1 * y) / r2 + (x1 + x2) / 2;
        cy = (k * -r2 * x) / r1 + (y1 + y2) / 2;
        f1 = Math.asin(parseFloat(((y1 - cy) / r2).toFixed(9)));
        f2 = Math.asin(parseFloat(((y2 - cy) / r2).toFixed(9)));
        if (x1 < cx) {
            f1 = Math.PI - f1;
        }
        if (x2 < cx) {
            f2 = Math.PI - f2;
        }
        if (f1 < 0) {
            f1 = Math.PI * 2 + f1;
        }
        if (f2 < 0) {
            f2 = Math.PI * 2 + f2;
        }
        if (sweepFlag && f1 > f2) {
            f1 = f1 - Math.PI * 2;
        }
        if (!sweepFlag && f2 > f1) {
            f2 = f2 - Math.PI * 2;
        }
    }
    let df = f2 - f1;
    if (Math.abs(df) > (Math.PI * angleThresh) / 180) {
        let f2old = f2;
        let x2old = x2;
        let y2old = y2;
        f2 =
            sweepFlag && f2 > f1 ?
                (f2 = f1 + ((Math.PI * angleThresh) / 180) * 1) :
                (f2 = f1 + ((Math.PI * angleThresh) / 180) * -1);
        x2 = cx + r1 * Math.cos(f2);
        y2 = cy + r2 * Math.sin(f2);
        params = arcCommandToBezier({
            x: x2,
            y: y2
        },
            [r1, r2, angle, 0, sweepFlag, x2old, y2old],
            quadratic,
            angleThresh,
            [f2, f2old, cx, cy]
        );
    }
    df = f2 - f1;
    let c1 = Math.cos(f1);
    let s1 = Math.sin(f1);
    let c2 = Math.cos(f2);
    let s2 = Math.sin(f2);
    let t = Math.tan(df / 4);
    let hx = (4 / 3) * r1 * t;
    let hy = (4 / 3) * r2 * t;
    let m1 = [x1, y1];
    let m2 = [x1 + hx * s1, y1 - hy * c1];
    let m3 = [x2 + hx * s2, y2 - hy * c2];
    let m4 = [x2, y2];
    m2[0] = 2 * m1[0] - m2[0];
    m2[1] = 2 * m1[1] - m2[1];
    if (recursive) {
        return [m2, m3, m4].concat(params);
    } else {
        params = [m2, m3, m4].concat(params);
        let commands = [];
        for (var i = 0; i < params.length; i += 3) {
            r1 = rotate(params[i][0], params[i][1], angleRad);
            r2 = rotate(params[i + 1][0], params[i + 1][1], angleRad);
            r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad);
            let cp1Q = interpolate(r3.x, r3.y, r2.x, r2.y, 3 / 2)
            if (quadratic) {
                commands.push({
                    type: 'Q',
                    values: [cp1Q.x, cp1Q.y, r3.x, r3.y]
                })
            } else {
                commands.push({
                    type: "C",
                    values: [r1.x, r1.y, r2.x, r2.y, r3.x, r3.y]
                });
            }
        }
        return commands;
    }
}

/**
* convert quadratic commands to cubic
*/
function pathDataQuadratic2Cubic(p0, com) {
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
