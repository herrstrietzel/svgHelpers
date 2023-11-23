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
    let comLengths = {
        m: 2,
        a: 7,
        c: 6,
        h: 1,
        l: 2,
        q: 4,
        s: 4,
        t: 2,
        v: 1,
        z: 0
    };

    let errors = [];

    for (let i = 0; i < commands.length; i++) {
        let com = commands[i].split(" ");
        let type = com.shift();
        let typeRel = type.toLowerCase();
        let isRel = type === typeRel;

        /**
         * long arc and sweep flags
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
            //count = chunkSize
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
    let pathDataAbs = [];
    let offX = 0;
    let offY = 0;
    let lastX = pathData[0].values[0];
    let lastY = pathData[0].values[1];

    // merge default options
    options = {
        ...{ unshort: true, convertQuadratic: false, convertArc: false, arcAccuracy: 1 },
        ...options
    }
    let { unshort, convertQuadratic, convertArc, arcAccuracy } = options

    pathData.forEach((com, i) => {
        let { type, values } = com;
        let typeRel = type.toLowerCase();
        let typeAbs = type.toUpperCase();
        let valuesL = values.length;
        let isRelative = type === typeRel;
        let comPrev = i > 0 ? pathData[i - 1] : pathData[0];
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;


        if (isRelative) {
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
        if (unshort) {

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


        let p0 = {
            x: lastX,
            y: lastY
        };

        //convert quadratic
        if (convertQuadratic && (com.type === 'Q' || com.type === 'T')) {

            // unshort
            if (com.type === 'T') {
                // new control point
                cpN1X = lastX + (lastX - valuesPrev[0]);
                cpN1Y = lastY + (lastY - valuesPrev[1]);
                com.type = 'Q';
                com.values = [cpN1X, cpN1Y, com.values[0], com.values[1]]
            }
            com = pathDataQuadratic2Cubic(p0, com.values);
        }

        //convert arcs to cubics
        if (convertArc && com.type === 'A') {

            // add all C commands instead of Arc
            let cubicArcs = arcToBezier(p0, com.values, arcAccuracy);
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

    });

    return pathDataAbs;

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
 * convert arctocommands to cubic bezier
 * based on a2c.js
 * https://github.com/fontello/svgpath/blob/master/lib/a2c.js
 * returns pathData array
*/

function arcToBezier(p0, values, splitSegments = 1, quadratic = false) {
    p0 = Array.isArray(p0) ? { x: p0[0], y: p0[1] } : p0;
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
    splitSegments = quadratic ? splitSegments * 2 : splitSegments;
    let segments = ratio * splitSegments;
    ang2 /= segments
    let pathData = [];


    // If 90 degree circular arc, use a consMath.tant
    // as derived from http://spencermortensen.com/articles/bezier-circle
    // c≈0.5519150244935105707435627

    const angle90 = 1.5707963267948966;
    const c = 0.5519150244935106
    let a = ang2 === angle90 ? c :
        (
            ang2 === -angle90 ? -c : 4 / 3 * Math.tan(ang2 / 4)
        );

    let cos2 = ang2 ? Math.cos(ang2) : 1;
    let sin2 = ang2 ? Math.sin(ang2) : 0;
    let type = !quadratic ? 'C' : 'Q';

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

        //convert to quadratic
        if (quadratic) {
            let p = { x: com.values[4], y: com.values[5] }
            let cp1 = {
                x: (com.values[0] - p0.x) * (1 + c) + p0.x,
                y: (com.values[1] - p0.y) * (1 + c) + p0.y
            };
            com.values = [cp1.x, cp1.y, p.x, p.y]
            p0 = p
        }

        pathData.push(com);
        ang1 += ang2
    }

    return pathData;

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

        let type = (com0.type === com.type && minify)
            ? " "
            : ((com0.type === "m" && com.type === "l") ||
                (com0.type === "M" && com.type === "l") ||
                (com0.type === "M" && com.type === "L"))
                && minify
                ? " " : com.type;

        // round
        if (decimals >= 0) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) })
        }

        //type = com.type;
        d += `${type}${com.values.join(" ")}`;
    }

    d = minify
        ? d
            .replaceAll(" 0.", " .")
            .replaceAll(" -", "-")
            .replace(/\s+([A-Za-z])/g, "$1")
            .replaceAll("Z", "z")
        : d;
    return d;
}
