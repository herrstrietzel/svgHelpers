/** 
* Convert svg paths using the upcoming getPathData() method
* which is expected to be natively supported by browsers
* and the successors of the deprecated pathSegList() methods
* 
* Based on the svg working draft 
* https://svgwg.org/specs/paths/#InterfaceSVGPathData
* 
* customized parser - based on Jarek Foksa's polyfill
* https://github.com/jarek-foksa/path-data-polyfill
* Usage via cdn:
* CDN: https://cdn.jsdelivr.net/npm/path-data-polyfill@latest/path-data-polyfill.min.js
* 
*/

/**
* custom pathData() and setPathData() methods
**/
SVGGeometryElement.prototype.getPathDataOpt = function (options = {}, conversion = true) {
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

            // Get rid of redundant "A" segs when either rx or ry is 0
            pathData = pathData.filter(function (s) {
                return s.type === "A" && (s.values[0] === 0 || s.values[1] === 0) ? false : true;
            });
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
                { type: "A", values: [rx, ry, 0, 0, 1, cx, cy + ry] },
                { type: "A", values: [rx, ry, 0, 0, 1, cx - rx, cy] },
                { type: "A", values: [rx, ry, 0, 0, 1, cx, cy - ry] },
                { type: "A", values: [rx, ry, 0, 0, 1, cx + rx, cy] },
                { type: "Z", values: [] }
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
     * set defaults 
     * for processing you usually need 
     * absolute and longhand commands
     */
    options = {
        normalize: options.normalize ? options.normalize : false,
        arcsToCubic: options.arcsToCubic ? options.arcsToCubic : false,
        absolute: options.absolute ? options.absolute : true,
        relative: options.relative ? options.relative : false,
        longhands: options.longhands ? options.longhands : true,
        shorthands: options.shorthands ? options.shorthands : false,
        decimals: (options.decimals || options.decimals === 0) ? options.decimals : 9
    };

    if (conversion || options.normalize) {
        pathData = convertPathData(pathData, options);
    }
    return pathData;
};


/**
 * wrapper for getPathData() and setPathData()
 * use natively supported/previously polyfilled methods
 */
if (!SVGPathElement.prototype.getPathData || !SVGPathElement.prototype.setPathData) {
    SVGGeometryElement.prototype.getPathData = function (options = {}) {
        let pathData = this.getPathDataOpt(options, false);
        return pathData;
    };
    SVGPathElement.prototype.setPathData = function (pathData, conversion = false) {
        this.setPathDataOpt(pathData, { relative: false, shorthands: false, decimals: 12 }, conversion);
    };
}

/**
 * retrieve patData from primitives:
 * <circle>, <ellipse>, <rect>, <polygon>, <polyline>, <line>, 
 */
SVGGeometryElement.prototype.convertPrimitiveToPath = function (options = {}) {
    let pathData = this.getPathDataOpt();

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
      attArr.forEach(function (att) {
        attObj[att.nodeName] = att.nodeValue;
      });
      return attObj;
    }

    let attributes = getAttributes(this);

    //exclude attributes not needed for paths
    let exclude = [
      "x",
      "y",
      "x1",
      "y1",
      "x2",
      "y2",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "points",
      "height",
      "width"
    ];
    // copy attributes to path and set pathData
    setAttributes(path, attributes, exclude);
    path.setPathDataOpt(pathData, options);
    this.replaceWith(path);
    return path;
}


/**
* create pathData from d attribute
**/
function parseDtoPathData(d, normalize = false) {
    // sanitize d string
    let commandsString = d
        // remove new lines and tabs
        .replace(/[\n\r\t]/g, "")
        // replace comma with space
        .replace(/,/g, " ")
        // add space before minus sign
        .replace(/(\d+)(\-)/g, "$1 $2")
        // decompose multiple decimal delimiters like 0.5.5 => 0.5 0.5
        .replace(/(\.)(\d+)(\.)(\d+)/g, "$1$2 $3$4")
        .replace(/(\.)(\d+)(\.)(\d+)/g, "$1$2 $3$4")
        // split multiple zero valuues like 0 05 => 0 0 5
        .replace(/( )(0)(\d+)/g, "$1 $2 $3")
        // add space between all valid command letters and values - excludes scientific e notation
        .replace(/([mlcsqtahvz])/gi, "|$1 ")
        // remove duplicate whitespace
        .replace(/\s{2,}/g, " ")
        // remove whitespace from right and left
        .trim();

    let commands = commandsString
        .split("|")
        .filter(Boolean)
        .map((val) => {
            return val.trim();
        });

    // compile pathData
    let pathData = [];

    for (let i = 0; i < commands.length; i++) {
        let com = commands[i].split(" ");
        let type = com.shift();
        let typeLc = type.toLowerCase();
        let isRelative = type === typeLc ? true : false;

        // convert to numbers
        let values = com.map((val) => {
            return +(val);
        });

        // analyze repeated (shorthanded) commands
        let chunks = [];
        let repeatedType = type;
        // maximum values for a specific command type
        let maxValues = 2;
        switch (typeLc) {
            case "v":
            case "h":
                maxValues = 1;
                if (typeLc === "h") {
                    repeatedType = isRelative ? "h" : "H";
                } else {
                    repeatedType = isRelative ? "v" : "V";
                }
                break;
            case "m":
            case "l":
            case "t":
                maxValues = 2;
                repeatedType =
                    typeLc !== "t" ? (isRelative ? "l" : "L") : isRelative ? "t" : "T";
                /**
                 * first starting point should be absolute/uppercase -
                 * unless it adds relative linetos
                 * (facilitates d concatenating)
                 */
                if (i === 0) {
                    type = "M";
                }
                break;
            case "s":
            case "q":
                maxValues = 4;
                repeatedType =
                    typeLc !== "q" ? (isRelative ? "s" : "S") : isRelative ? "q" : "Q";
                break;
            case "c":
                maxValues = 6;
                repeatedType = isRelative ? "c" : "C";
                break;
            case "a":
                maxValues = 7;
                repeatedType = isRelative ? "a" : "A";
                break;
            // z closepath
            default:
                maxValues = 0;
        }

        // if string contains repeated shorthand commands - split them
        const arrayChunks = (array, chunkSize = 2) => {
            let chunks = [];
            for (let i = 0; i < array.length; i += chunkSize) {
                let chunk = array.slice(i, i + chunkSize);
                chunks.push(chunk);
            }
            return chunks;
        };

        chunks = arrayChunks(values, maxValues);
        // add 1st/regular command
        let chunk0 = chunks.length ? chunks[0] : [];
        pathData.push({ type: type, values: chunk0 });
        // add repeated commands
        if (chunks.length > 1) {
            for (let c = 1; c < chunks.length; c++) {
                pathData.push({ type: repeatedType, values: chunks[c] });
            }
        }
    }

    /**
    * normalize to all absolute, cubic, no shorthand
    */
    if (normalize) {
        pathData = normalizePathData(pathData);
    }
    return pathData;
}

/**
* normalize to all absolute, cubic, no shorthand
*/
function normalizePathData(pathData) {
    let pathDataNorm = [];
    pathData = pathDataToLonghands(pathData);
    pathData.forEach((com, i) => {
        let [type, values] = [com.type, com.values];
        let comPrev = i > 0 ? pathData[i - 1] : pathData[i];
        let [typePrev, valuesPrev] = [comPrev.type, comPrev.values];
        let valuesPrevL = valuesPrev.length;
        let p0 = { x: valuesPrev[valuesPrevL - 2], y: valuesPrev[valuesPrevL - 1] };
        switch (type) {
            case 'A':
                let cubicArcs = pathDataArcToCubic(p0, values);
                cubicArcs.forEach(cubicArc => {
                    pathDataNorm.push(cubicArc);
                })
                break;
            case 'Q':
                pathDataNorm.push(pathDataQuadratic2Cubic(p0, values));
                break;
            default:
                pathDataNorm.push(com);
        }
    });
    return pathDataNorm;
}


/**
 * convert quadratic commands to cubic
 */
function pathDataQuadratic2Cubic(previous, command) {
    if (Array.isArray(previous)) {
        previous = {
            x: previous[0],
            y: previous[1]
        }
    }
    let cp1 = {
        x: previous.x + 2 / 3 * (command[0] - previous.x),
        y: previous.y + 2 / 3 * (command[1] - previous.y)
    }
    let cp2 = {
        x: command[2] + 2 / 3 * (command[0] - command[2]),
        y: command[3] + 2 / 3 * (command[1] - command[3])
    }
    return ({ type: "C", values: [cp1.x, cp1.y, cp2.x, cp2.y, command[2], command[3]] });
}


/**
 * convert arc commands to cubic
 * Based on: Dmitry Baranovskiy's
 * https://github.com/DmitryBaranovskiy/raphael/blob/v2.1.1/dev/raphael.core.js#L1837
 */
function pathDataArcToCubic(p0, comValues, recursive = false) {
    if (Array.isArray(p0)) {
        p0 = {
            x: p0[0],
            y: p0[1]
        }
    }
    let [r1, r2, angle, largeArcFlag, sweepFlag, x2, y2] = comValues;
    let [x1, y1] = [p0.x, p0.y];

    const degToRad = degrees => {
        return (Math.PI * degrees) / 180;
    };

    const rotate = (x, y, angleRad) => {
        let X = x * Math.cos(angleRad) - y * Math.sin(angleRad);
        let Y = x * Math.sin(angleRad) + y * Math.cos(angleRad);
        return { x: X, y: Y };
    };

    let angleRad = degToRad(angle);
    let params = [];
    let x, y, f1, f2, cx, cy, h;

    if (recursive) {
        f1 = recursive[0];
        f2 = recursive[1];
        cx = recursive[2];
        cy = recursive[3];
    }
    else {
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

        cx = k * r1 * y / r2 + (x1 + x2) / 2;
        cy = k * -r2 * x / r1 + (y1 + y2) / 2;
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

    if (Math.abs(df) > (Math.PI * 120 / 180)) {
        let f2old = f2;
        let x2old = x2;
        let y2old = y2;

        f2 = sweepFlag && f2 > f1 ?
            f2 = f1 + (Math.PI * 120 / 180) * (1) :
            f2 = f1 + (Math.PI * 120 / 180) * (-1);
        x2 = cx + r1 * Math.cos(f2);
        y2 = cy + r2 * Math.sin(f2);
        params = pathDataArcToCubic([x2, y2], [r1, r2, angle, 0, sweepFlag, x2old, y2old], [f2, f2old, cx, cy]);
    }

    df = f2 - f1;

    let c1 = Math.cos(f1);
    let s1 = Math.sin(f1);
    let c2 = Math.cos(f2);
    let s2 = Math.sin(f2);
    let t = Math.tan(df / 4);
    let hx = 4 / 3 * r1 * t;
    let hy = 4 / 3 * r2 * t;

    let m1 = [x1, y1];
    let m2 = [x1 + hx * s1, y1 - hy * c1];
    let m3 = [x2 + hx * s2, y2 - hy * c2];
    let m4 = [x2, y2];

    m2[0] = 2 * m1[0] - m2[0];
    m2[1] = 2 * m1[1] - m2[1];

    if (recursive) {
        return [m2, m3, m4].concat(params);
    }
    else {
        params = [m2, m3, m4].concat(params);
        let commands = [];
        for (var i = 0; i < params.length; i += 3) {
            r1 = rotate(params[i][0], params[i][1], angleRad);
            r2 = rotate(params[i + 1][0], params[i + 1][1], angleRad);
            r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad);
            commands.push({ type: 'C', values: [r1.x, r1.y, r2.x, r2.y, r3.x, r3.y] });
        }
        return commands;
    }
};



/**
 * decompose/convert shorthands to "longhand" commands:
 * H, V, S, T => L, L, C, Q
 * reversed method: pathDataToShorthands()
 */
function pathDataToLonghands(pathData) {
    pathData = pathDataToAbsolute(pathData);
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
        pathDataLonghand.push(comPrev);
    }
    return pathDataLonghand;
}

/**
 * apply shorthand commands if possible
 * L, L, C, Q => H, V, S, T
 * reversed method: pathDataToLonghands()
 */

function pathDataToShorthands(pathData) {
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
        pathDataShorts.push(comShort);
    }
    return pathDataShorts;
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
    }
    // round coordinates
    if (decimals >= 0) {
        pathData = roundPathData(pathData, decimals);
    }
    return pathData;
}

function pathDataToAbsolute(pathData, decimals = -1) {
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

    }
    // round coordinates
    if (decimals >= 0) {
        pathData = roundPathData(pathData, decimals);
    }
    return pathData;
}


/**
 * add optimizations like
 * rounding
 * relative and shorthand command
 */
function getDopt(pathData, options = {}) {
    // convert  to shorthands
    pathData = convertPathData(pathData, options);
    let d = pathData.map(com => {
        return `${com.type}${com.values.join(' ')}`;
    }).join('');
    // optimize whitespace and delimiters
    d = d.replaceAll(",", " ").replaceAll(" -", "-");
    return d;
}

/**
 * get optimized/converted
 * pathData array
 */
function convertPathData(pathData, options = {}) {
    // clone pathData array to prevent overwriting
    pathData = JSON.parse(JSON.stringify(pathData));

    // set defaults
    options = {
        normalize: options.normalize ? options.normalize : false,
        arcsToCubic: options.arcsToCubic ? options.arcsToCubic : false,
        absolute: options.absolute ? options.absolute : false,
        relative: options.relative ? options.relative : true,
        longhands: options.longhands ? options.longhands : false,
        shorthands: options.shorthands ? options.shorthands : true,
        decimals: (options.decimals || options.decimals === 0) ? options.decimals : 3
    };
    let { normalize, arcsToCubic, absolute, relative, longhands, shorthands, decimals } = options;

    // normalize: quadratic to cubic, arcs to curvetos, all absolute
    if (normalize) {
        pathData = roundPathData(normalizePathData(pathData), decimals);
    } else {
        // arcsToCubic
        if (arcsToCubic) {
            pathData = normalizePathData(pathData);
        }
        // convert  to shorthands
        pathData = shorthands && !longhands ?
            pathDataToShorthands(pathData) :
            (longhands ? pathDataToLonghands(pathData) : pathData);

        // convert to relative and round
        pathData = (!absolute && relative) ? pathDataToRelative(pathData, decimals) : pathDataToAbsolute(pathData, decimals);
    }
    return pathData;
}

// pathData to d string without optimizations
function pathDataToD(pathData) {
    let d = pathData.map(com => {
        return `${com.type}${com.values.join(' ')}`;
    }).join('');
    return d;
}

// set pathData with optimizations
SVGPathElement.prototype.setPathDataOpt = function (pathData, options = {}, conversion = true) {
    let d = conversion ? getDopt(pathData, options) : pathDataToD(pathData);
    this.setAttribute("d", d);
};


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
* convert pathData array
*/

function convertSnapPathData(pathDataSnap) {
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

function revertSnapPathData(pathData) {
    let pathDataSnap = [];
    pathData.forEach(com => {
        pathDataSnap.push([com.type, com.values].flat())
    })
    return pathDataSnap;
}



/**
 * add readable command point data 
 * to pathData command objects
 */
function pathDataToVerbose(pathData) {
    pathData = pathDataToLonghands(pathData);
    let pathDataVerbose = [];
    let pathDataL = pathData.length;
    let closed = pathData[pathDataL - 1].type === 'Z' ? true : false;
    pathData.forEach((com, i) => {
        let {
            type,
            values
        } = com;
        let typeLc = type.toLowerCase();
        let valuesL = values.length;
        let comPrev = pathData[i - 1] ? pathData[i - 1] : false;
        let comPrevValues = comPrev ? comPrev.values : [];
        let comPrevValuesL = comPrevValues.length;
        let p = valuesL ? {
            x: values[valuesL - 2],
            y: values[valuesL - 1]
        } : (i === pathData.length - 1 && closed ? pathData[0].values : false);
        let comObj = {
            type: type,
            values: values,
            p: p
        }
        if (comPrevValuesL) {
            comObj.pPrev = {
                x: comPrevValues[comPrevValuesL - 2],
                y: comPrevValues[comPrevValuesL - 1]
            }
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
                comObj.rx = values[0]
                comObj.ry = values[1]
                comObj.rotation = values[2]
                comObj.largeArcFlag = values[3]
                comObj.sweepFlag = values[4]
                break;
        }
        pathDataVerbose.push(comObj);
    });
    return pathDataVerbose;
}
