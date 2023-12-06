/** 
* Convert svg paths from 
* - d attribute strings
* - path or geometry elements (e.g. circle, rect, ellipse etc.) via getPathData2 method
* 
* Based on the svg working draft 
* https://svgwg.org/specs/paths/#InterfaceSVGPathData
* 
* customized parser - inspired by Jarek Foksa's polyfill
* https://github.com/jarek-foksa/path-data-polyfill
*/


/**
* custom pathData() and setPathData() methods
**/
SVGGeometryElement.prototype.getPathData2 = function (options = {}) {
    let pathData = [];
    let type = this.nodeName;
    let d, x, y, width, height, r, rx, ry, cx, cy;

    switch (type) {
        case 'path':
            d = this.getAttribute("d");
            pathData = parseDtoPathData(d);
            break;

        case 'rect':
            x = this.x.baseVal.value;
            y = this.y.baseVal.value;
            width = this.width.baseVal.value;
            height = this.height.baseVal.value;
            rx = this.hasAttribute("rx") ? this.rx.baseVal.value : this.ry.baseVal.value;
            ry = this.hasAttribute("ry") ? this.ry.baseVal.value : this.rx.baseVal.value;

            if (rx > width / 2) {
                rx = width / 2;
            }
            if (ry > height / 2) {
                ry = height / 2;
            }

            if (!rx && !ry) {
                pathData = [
                    { type: "M", values: [x, y] },
                    { type: "H", values: [x + width] },
                    { type: "V", values: [y + height] },
                    { type: "H", values: [x] },
                    { type: "Z", values: [] }
                ];
            } else {
                pathData = [
                    { type: "M", values: [x + rx, y] },
                    { type: "H", values: [x + width - rx] },
                    { type: "A", values: [rx, ry, 0, 0, 1, x + width, y + ry] },
                    { type: "V", values: [y + height - ry] },
                    { type: "A", values: [rx, ry, 0, 0, 1, x + width - rx, y + height] },
                    { type: "H", values: [x + rx] },
                    { type: "A", values: [rx, ry, 0, 0, 1, x, y + height - ry] },
                    { type: "V", values: [y + ry] },
                    { type: "A", values: [rx, ry, 0, 0, 1, x + rx, y] },
                    { type: "Z", values: [] }
                ];
            }
            break;

        case 'circle':
        case 'ellipse':
            cx = this.cx.baseVal.value;
            cy = this.cy.baseVal.value;
            if (type === 'circle') {
                r = this.r.baseVal.value;
            }
            rx = this.rx ? this.rx.baseVal.value : r;
            ry = this.ry ? this.ry.baseVal.value : r;

            pathData = [
                { type: "M", values: [cx + rx, cy] },
                { type: "A", values: [rx, ry, 0, 1, 1, cx - rx, cy] },
                { type: "A", values: [rx, ry, 0, 1, 1, cx + rx, cy] },
            ];

            break;
        case 'line':
            pathData = [
                { type: "M", values: [this.x1.baseVal.value, this.y1.baseVal.value] },
                { type: "L", values: [this.x2.baseVal.value, this.y2.baseVal.value] }
            ];
            break;
        case 'polygon':
        case 'polyline':
            for (let i = 0; i < this.points.numberOfItems; i++) {
                let point = this.points.getItem(i);
                pathData.push({
                    type: (i === 0 ? "M" : "L"),
                    values: [point.x, point.y]
                });
            }
            if (type === 'polygon') {
                pathData.push({
                    type: "Z",
                    values: []
                });
            }
            break;
    }

    /**
     * normalize commands 
     * for processing you usually need 
     * absolute and longhand commands
     */

    if (options.normalize === true) {
        options =
        {
            toAbsolute: true,
            arcToCubic: true,
            arcAccuracy: 1,
            quadraticToCubic: true,
            toLonghands: true,
        }
    }

    if (Object.keys(options).length) {
        pathData = normalizePathData(pathData, options)
    }

    return pathData;
};

// set pathData with optimizations
SVGPathElement.prototype.setPathData2 = function (pathData, options = {}) {

    let defaults = {
        // shorthand for toRelative, toShorthandshands
        optimize: false,
        toAbsolute: false,
        toRelative: false,
        quadraticToCubic: false,
        toLonghands: false,
        cleanClosePath: false,

        // arcs to cubic bezier
        arcToCubic: false,
        arcAccuracy: 1,

        //only for set pathdata
        minify: false,
        decimals: -1, //rounding
        toShorthands: false, //apply shorthands
    }

    // merge defaults
    options = {
        ...defaults,
        ...options
    }

    let { optimize, decimals, minify, toRelative, toAbsolute, quadraticToCubic, arcToCubic, arcAccuracy, toLonghands, toShorthands, cleanClosePath } = options

    if (optimize) {
        toShorthands = true
        toRelative = true
        decimals = 3,
            cleanClosePath = true
    }


    let lastCom = pathData[pathData.length - 1];
    let secondLast = pathData[pathData.length - 2];
    let secondLastValues = secondLast.values

    if (cleanClosePath && lastCom.type.toLowerCase() === 'z') {

        //let lastCurve
        if (secondLast.type === 'L' && secondLast.values.join(',') === pathData[0].values.join(',')) {
            //remove last lineto
            pathData.splice(pathData.length - 2, 1)
        }

        if (secondLast.type !== 'L' && [secondLastValues[secondLastValues.length - 2], secondLastValues[secondLastValues.length - 1]].join(',') === pathData[0].values.join(',')) {
            // remove last command
            pathData.pop()
        }
    }


    if (quadraticToCubic || arcToCubic) {
        pathData = normalizePathData(pathData, options)
    }

    if (toShorthands) {
        pathData = pathDatatoShorthandshands(pathData, decimals)
    }
    else if (toLonghands) {
        pathData = pathDataToLonghands(pathData, decimals)
    }

    if (toRelative) {
        pathData = pathDataToRelative(pathData, decimals)
    }
    else if (toAbsolute) {
        pathData = pathDataToAbsolute(pathData, decimals)
    }

    let d = pathDataToD(pathData, decimals, minify);
    this.setAttribute("d", d);
};


/**
 * retrieve patData from primitives:
 * <circle>, <ellipse>, <rect>, <polygon>, <polyline>, <line>, 
 */
SVGGeometryElement.prototype.convertPrimitiveToPath = function (options) {
    let pathData = this.getPathData2(options);

    // create path element
    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // get all attributes as object
    const setAttributes = (el, attributes, exclude = []) => {
        for (key in attributes) {
            if (exclude.indexOf(key) === -1) {
                el.setAttribute(key, attributes[key]);
            }
        }
    }
    const getAttributes = (el) => {
        let attArr = [...el.attributes];
        let attObj = {};
        attArr.forEach((att) => {
            attObj[att.nodeName] = att.nodeValue;
        });
        return attObj;
    }

    let attributes = getAttributes(this);

    //exclude attributes not needed for paths
    let exclude = ["x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "points", "width", "height"];
    // copy attributes to path and set pathData
    setAttributes(path, attributes, exclude);
    path.setPathData2(pathData);
    this.replaceWith(path);
    return path;
}

/**
 * parse pathData from d attribute
 **/
function parseDtoPathData(d) {
    let dClean = d
        // remove new lines and tabs
        .replace(/[\n\r\t]/g, "")
        // replace comma with space
        .replace(/,/g, " ")
        // add space before minus sign
        .replace(/(\d+)(\-)/g, "$1 $2")
        // decompose multiple adjacent decimal delimiters like 0.5.5.5 => 0.5 0.5 0.5
        .replace(/(\.)(?=(\d+\.\d+)+)(\d+)/g, "$1$3 ")
        // add new lines before valid command letters
        .replace(/([mlcsqtahvz])/gi, "\n$1 ")
        // remove duplicate whitespace
        .replace(/\ {2,}/g, " ")
        // remove whitespace from right and left
        .trim();

    // split commands
    let commands = dClean.split("\n").map((val) => {
        return val.trim();
    });

    // compile pathData
    let pathData = [];
    let comLengths = { m: 2, a: 7, c: 6, h: 1, l: 2, q: 4, s: 4, t: 2, v: 1, z: 0 };
    let errors = [];

    for (let i = 0; i < commands.length; i++) {
        let com = commands[i].split(" ");
        let type = com.shift();
        let typeRel = type.toLowerCase();
        let isRel = type === typeRel;

        /**
         * large arc and sweep flags
         * are boolean and can be concatenated like
         * 11 or 01
         */
        if (typeRel === "a") {
            if (com.length < comLengths[typeRel]) {
                let lastFlag = com[3];
                if (lastFlag.length > 1) {
                    let flagArr = lastFlag.split("");
                    com = [
                        com[0],
                        com[1],
                        com[2],
                        +flagArr[0],
                        +flagArr[1],
                        com[4],
                        com[5]
                    ];
                }
            }
        }

        // convert to numbers
        let values = com.map((val) => {
            return parseFloat(val);
        });

        // if string contains repeated shorthand commands - split them
        let chunkSize = comLengths[typeRel];
        let chunk = values.slice(0, chunkSize);
        pathData.push({ type: type, values: chunk });

        // too few values
        if (chunk.length < chunkSize) {
            errors.push(
                `${i}. command (${type}) has ${chunk.length}/${chunkSize} values - ${chunkSize - chunk.length} too few`
            );
        }

        // has implicit commands
        if (values.length > chunkSize) {
            let typeImplicit = type === "M" ? (isRel ? "l" : "L") : type;
            for (let i = chunkSize; i < values.length; i += chunkSize) {
                let chunk = values.slice(i, i + chunkSize);
                pathData.push({ type: typeImplicit, values: chunk });
                if (chunk.length !== chunkSize) {
                    errors.push(
                        `${i}. command (${type}) has ${chunk.length + chunkSize}/${chunkSize} - ${chunk.length} values too many `
                    );
                }
            }
        }
    }
    if (errors.length) {
        console.log(errors);
    }

    /**
     * first M is always absolute/uppercase -
     * unless it adds relative linetos
     * (facilitates d concatenating)
     */
    pathData[0].type = 'M'
    return pathData;
}



/**
 * converts all commands to absolute
 * optional: convert shorthands; arcs to cubics 
 */

function normalizePathData(pathData, options) {
    // add M
    let pathDataAbs = [pathData[0]];
    let offX = 0;
    let offY = 0;
    let lastX = pathData[0].values[0];
    let lastY = pathData[0].values[1];


    // merge default options
    let defaults = {
        toAbsolute: true,
        toRelative: false,
        quadraticToCubic: false,
        toLonghands: true,
        arcToCubic: false,
        arcAccuracy: 1,
        decimals: -1,
    }

    options = {
        ...defaults,
        ...options
    }

    let { toAbsolute, toRelative, quadraticToCubic, toLonghands, arcToCubic, arcAccuracy, decimals } = options;

    /**
     * arcToCubic, quadraticToCubic, toLonghands  
     * will force toAbsolute conversion
     */

    if (arcToCubic || toLonghands || quadraticToCubic) {
        toAbsolute = true
    }

    let commandTokens = pathData.map(com => { return com.type }).join('')
    let hasRel = /[astvqmhlc]/g.test(commandTokens);
    let hasShorthands = /[hstv]/gi.test(commandTokens);
    let hasQuadratics = /[qt]/gi.test(commandTokens);
    let hasArcs = /[a]/gi.test(commandTokens);

    if (!hasRel && !hasShorthands && !hasQuadratics && !hasArcs && !toRelative) {
        //console.log('nothing to normalize');
        return pathData
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

        // conver quadratic to cubic
        if (quadraticToCubic && hasQuadratics && com.type === 'Q') {
            com = pathDataQuadratic2Cubic(p0, com.values)
        }

        //convert arcs to cubics
        if (arcToCubic && hasArcs && com.type === 'A') {
            // add all C commands instead of Arc
            let cubicArcs = arcToBezier({ x: lastX, y: lastY }, com.values, arcAccuracy);
            cubicArcs.forEach((cubicArc) => {
                pathDataAbs.push(cubicArc);
            });

        } else {
            // add command
            pathDataAbs.push(com)
        }

        // update offsets
        lastX = valuesL > 1 ? values[valuesL - 2] + offX : (typeRel === 'h' ? values[0] + offX : lastX);
        lastY = valuesL > 1 ? values[valuesL - 1] + offY : (typeRel === 'v' ? values[0] + offY : lastY);
        offX = lastX;
        offY = lastY;
    };


    // to Relative
    if (toRelative) {
        pathDataAbs = pathDataToRelative(pathDataAbs, decimals)
    }

    return pathDataAbs;
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
    let pathData = [];


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
        pathData.push(com);
        ang1 += ang2
    }

    return pathData;
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
        if (decimals >= 0) {
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
        if (decimals >= 0) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) })
        }
    }
    return pathData;
}


/**
 * decompose/convert shorthands to "longhand" commands:
 * H, V, S, T => L, L, C, Q
 * reversed method: pathDatatoShorthandshands()
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
        if (decimals >= 0) {
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
function pathDatatoShorthands(pathData, decimals = -1) {
    pathData = pathDataToAbsolute(pathData, decimals);
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

        // round final values
        if (decimals >= 0) {
            comShort.values = comShort.values.map(val => { return +val.toFixed(decimals) })
        }

        pathDataShorts.push(comShort);
    }
    return pathDataShorts;
}


/**
* serialize pathData array to 
* d attribute string 
*/
function pathDataToD(pathData, decimals = -1, minify = false) {
    // implicit l command
    if (pathData[1].type === "l" && minify) {
        pathData[0].type = "m";
    }
    let d = `${pathData[0].type}${pathData[0].values.join(" ")}`;
    for (let i = 1; i < pathData.length; i++) {
        let com0 = pathData[i - 1];
        let com = pathData[i];

        let type = (com0.type === com.type && minify) ?
            " " : (
                (com0.type === "m" && com.type === "l") ||
                (com0.type === "M" && com.type === "l") ||
                (com0.type === "M" && com.type === "L")
            ) && minify ?
                " " : com.type;

        // round
        if (com.values.length && decimals >= 0) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) })
        }
        d += `${type}${com.values.join(" ")}`;
    }

    // optimize whitespace
    d = minify
        ? d
            .replaceAll(" 0.", " .")
            .replaceAll(" -", "-")
            .replaceAll("-0.", "-.")
            .replace(/\s+([A-Za-z])/g, "$1")
            .replaceAll("Z", "z")
        : d;
    return d;
}

/**
 * round pathData
 * decimals=-1 => no rounding
 */
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
