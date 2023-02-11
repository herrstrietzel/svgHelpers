/**
 * includes pathData.measureAndLabel.js
 */

function pathDataToQuadratic(pathData, precision = 1) {
    let pathDataL = pathData.length;

    for (let i = 1; i > -1 && i < pathDataL && i < 500; i++) {
        let com = pathData[i];
        let { type, values } = com;
        let comPrev = pathData[i - 1];
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let valuesL = values.length;
        let p0 = { x: valuesPrev[valuesPrevL - 2], y: valuesPrev[valuesPrevL - 1] };
        let p = { x: values[valuesL - 2], y: values[valuesL - 1] };

        switch (type) {
            case 'C':
                let cp1 = { x: values[valuesL - 6], y: values[valuesL - 5] };
                let cp2 = { x: values[valuesL - 4], y: values[valuesL - 3] };
                let midC = getPointAtCubicSegmentLength(p0, cp1, cp2, p, 0.5);
                let cp1Q = checkLineIntersection(p0, cp1, p, cp2, false);

                // can interpolate quadratic controlpoint
                if (cp1Q) {
                    // mid quadratic
                    let midQ = getPointAtQuadraticSegmentLength(p0, cp1Q, p, 0.5);

                    /**
                     * 1. can be converted directly 
                     */
                    if (samePoint(midQ, midC, precision)) {
                        pathData[i] = { type: 'Q', values: [cp1Q.x, cp1Q.y, p.x, p.y] }
                    }

                    /**
                     * 2. split cubic 
                     */
                    else {
                        // intersection controlpoints
                        let cpIntersection = checkLineIntersection(p0, cp1, p, cp2, true);

                        // get angle between p0 and controlpoints
                        let angle = getAngleABC(p0, cp1, cp2);
                        let splitPasses = 1;

                        if (cpIntersection) {
                            splitPasses = precision > 1 ? 2 : 3
                        }

                        if (angle >= 90) {
                            splitPasses = precision > 1 ? 1 : 2
                        }

                        let pathDataSeg = [
                            { type: 'M', values: [p0.x, p0.y] },
                            com
                        ];

                        // split segment
                        pathDataSeg = splitPathDataSegNtimes(pathDataSeg, i, splitPasses);
                        pathDataSeg.shift();
                        pathData[i] = pathDataSeg;
                        pathData = pathData.flat();
                        pathDataL = pathData.length;
                    }

                }
                // can't interpolate quadratic controlpoint - split
                else {
                    splitPasses = 2;
                    let pathDataSeg = [
                        { type: 'M', values: [p0.x, p0.y] },
                        com
                    ];

                    // split segment
                    pathDataSeg = splitPathDataSegNtimes(pathDataSeg, i, splitPasses);
                    pathDataSeg.shift();
                    pathData[i] = pathDataSeg;
                    pathData = pathData.flat();
                    pathDataL = pathData.length;

                }
                break;
        }
    }

    return pathData;
}



/**
 * split command multiple times
 */
function splitPathDataSegNtimes(pathData, currentSeg, passes = 1) {
    // multiple 
    let splits = 1;
    for (let i = 0; i < passes; i++) {
        currentSeg = splits;
        for (let s = 0; s < splits; s++) {
            pathData = splitNthPathSegmentAtT(pathData, currentSeg, 0.5);
            currentSeg--
        }
        splits *= 2;
    }
    return pathData;
}


/**
 * split nth path segment at "t"
 */
function splitNthPathSegmentAtT(pathData, i = 1, t = 0.5) {
    let newPathData = [];
    let pathDataL = pathData.length;
    let com = pathData[i];
    let { type, values } = com;

    let valuesL = values.length;
    let comPrev = pathData[i - 1];
    let valuesPrev = comPrev ? comPrev.values : [];
    let valuesPrevL = valuesPrev.length;
    let p0, cp1, cp2, p1, p2, m0, m1, m2, m3, m4;

    //copy previous commands
    for (let c = 0; c < i; c++) {
        newPathData.push(pathData[c])
    }

    switch (type) {
        case "C":
            p0 = {
                x: valuesPrev[valuesPrevL - 2],
                y: valuesPrev[valuesPrevL - 1]
            };
            cp1 = {
                x: values[valuesL - 6],
                y: values[valuesL - 5]
            };
            cp2 = {
                x: values[valuesL - 4],
                y: values[valuesL - 3]
            };

            p1 = {
                x: values[valuesL - 2],
                y: values[valuesL - 1]
            };
            m0 = interpolatedPoint(p0, cp1, t);
            m1 = interpolatedPoint(cp1, cp2, t);
            m2 = interpolatedPoint(cp2, p1, t);
            m3 = interpolatedPoint(m0, m1, t);
            m4 = interpolatedPoint(m1, m2, t);

            // split end point
            p2 = interpolatedPoint(m3, m4, t);

            // first segment
            newPathData.push({
                type: "C",
                values: [m0.x, m0.y, m3.x, m3.y, p2.x, p2.y]
            });
            // second segment
            newPathData.push({
                type: "C",
                values: [m4.x, m4.y, m2.x, m2.y, p1.x, p1.y]
            });

            break;
        case "Q":
            p0 = {
                x: valuesPrev[valuesPrevL - 2],
                y: valuesPrev[valuesPrevL - 1]
            };
            cp1 = {
                x: values[valuesL - 4],
                y: values[valuesL - 3]
            };
            p1 = {
                x: values[valuesL - 2],
                y: values[valuesL - 1]
            };
            m1 = interpolatedPoint(p0, cp1, t);
            m2 = interpolatedPoint(cp1, p1, t);
            p2 = interpolatedPoint(m1, m2, t);
            // first segment
            newPathData.push({
                type: "Q",
                values: [m1.x, m1.y, p2.x, p2.y]
            });
            // second segment
            newPathData.push({
                type: "Q",
                values: [m2.x, m2.y, p1.x, p1.y]
            });
            break;

        case "A":
            p0 = {
                x: valuesPrev[valuesPrevL - 2],
                y: valuesPrev[valuesPrevL - 1]
            };
            p1 = {
                x: values[valuesL - 2],
                y: values[valuesL - 1]
            };

            // create temporary path to calculate new points and long arc flags
            let ns = "http://www.w3.org/2000/svg";
            let svg = document.createElementNS(ns, "svg");
            let pathTmp = document.createElementNS(ns, "path");
            let d = `M ${p0.x} ${p0.y} ${type} ${values.join(" ")}`;
            pathTmp.setAttribute("d", d);

            let pathLength = pathTmp.getTotalLength();
            let tPos = pathLength * t;

            // new mid point
            m1 = pathTmp.getPointAtLength(tPos);

            // check if long arc flag needs to be changed
            let longArc = values[3];
            let longArc0 = longArc,
                longArc1 = longArc;

            if (longArc) {
                //get full circle length
                let pathFull = document.createElementNS(ns, "path");
                let dFull = `M ${p0.x} ${p0.y} ${type} ${[
                    values[0],
                    values[1],
                    values[2],
                    values[3],
                    values[4],
                    p0.x - 0.001,
                    p0.y
                ].join(" ")}`;
                pathFull.setAttribute("d", dFull);
                let pathLengthFull = pathFull.getTotalLength();
                longArc0 = tPos > pathLengthFull / 2 ? 1 : 0;
                longArc1 = pathLength - tPos > pathLengthFull / 2 ? 1 : 0;
            }

            // first segment
            newPathData.push({
                type: "A",
                values: [
                    values[0],
                    values[1],
                    values[2],
                    longArc0,
                    values[4],
                    m1.x,
                    m1.y
                ]
            });
            // second segment
            newPathData.push({
                type: "A",
                values: [
                    values[0],
                    values[1],
                    values[2],
                    longArc1,
                    values[4],
                    p1.x,
                    p1.y
                ]
            });
            break;

        case "L":
            p0 = {
                x: valuesPrev[valuesPrevL - 2],
                y: valuesPrev[valuesPrevL - 1]
            };
            p1 = {
                x: values[valuesL - 2],
                y: values[valuesL - 1]
            };
            m1 = interpolatedPoint(p0, p1, t);
            // first segment
            newPathData.push({
                type: "L",
                values: [m1.x, m1.y]
            });
            // second segment
            newPathData.push({
                type: "L",
                values: [p1.x, p1.y]
            });
            break;

        default:
            newPathData.push(com);
    }

    //copy next
    for (let c = i + 1; c < pathDataL; c++) {
        newPathData.push(pathData[c])
    }

    return newPathData;
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
function getPointAtCubicSegmentLength(p0, cp1, cp2, p, t = 0.5) {
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

function getPointAtQuadraticSegmentLength(p0, cp1, p, t = 0.5) {
    let t1 = 1 - t;
    return {
        x: t1 * t1 * p0.x + 2 * t1 * t * cp1.x + t ** 2 * p.x,
        y: t1 * t1 * p0.y + 2 * t1 * t * cp1.y + t ** 2 * p.y
    };
}

function getPointAtArcSegmentLength(p0, comValues, t) {
    if (Array.isArray(p0)) {
        p0 = {
            x: p0[0],
            y: p0[1]
        };
    }
    let ns = "http://www.w3.org/2000/svg";
    let pathTmp = document.createElementNS(ns, "path");
    let d = `M${p0.x} ${p0.y}  A ${comValues.join(" ")}`;
    pathTmp.setAttribute("d", d);
    let pathLength = pathTmp.getTotalLength();
    point = pathTmp.getPointAtLength(pathLength * t);
    pathTmp.remove();
    return point;
}


/**
* pathData.measureAndLabel.js
* helpers for calculations like:
* distance between points, angles
* recalculate viewBox
*/

// get distance
function getDistance(p1, p2) {
    if (Array.isArray(p1)) {
        p1.x = p1[0];
        p1.y = p1[1];
    }
    if (Array.isArray(p2)) {
        p2.x = p2[0];
        p2.y = p2[1];
    }

    let [x1, y1, x2, y2] = [p1.x, p1.y, p2.x, p2.y];
    let y = x2 - x1;
    let x = y2 - y1;
    return Math.sqrt(x * x + y * y);
}

// get angle helper
function getAngle(p1, p2) {
    let angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
    //console.log(angle);
    return angle;
}

// get angle between 3 points helper
function getAngleABC(A, B, C) {
    let BA = Math.sqrt(Math.pow(A.x - B.x, 2) + Math.pow(A.y - B.y, 2));
    let AC = Math.sqrt(Math.pow(A.x - C.x, 2) + Math.pow(A.y - C.y, 2));
    let BC = Math.sqrt(Math.pow(C.x - B.x, 2) + Math.pow(C.y - B.y, 2));
    let angle = Math.acos((AC * AC + BA * BA - BC * BC) / (2 * AC * BA)) * 180 / Math.PI;
    return angle;
}

/**
 * based on:  Justin C. Round's 
 * http://jsfiddle.net/justin_c_rounds/Gd2S2/light/
 */

function checkLineIntersection(p1, p2, p3, p4, exact = true) {
    // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
    let denominator, a, b, numerator1, numerator2;

    let intersectionPoint = {}

    denominator = ((p4.y - p3.y) * (p2.x - p1.x)) - ((p4.x - p3.x) * (p2.y - p1.y));
    if (denominator == 0) {
        return false;
    }
    a = p1.y - p3.y;
    b = p1.x - p3.x;
    numerator1 = ((p4.x - p3.x) * a) - ((p4.y - p3.y) * b);
    numerator2 = ((p2.x - p1.x) * a) - ((p2.y - p1.y) * b);

    a = numerator1 / denominator;
    b = numerator2 / denominator;

    // if we cast these lines infinitely in both directions, they intersect here:
    intersectionPoint = {
        x: p1.x + (a * (p2.x - p1.x)),
        y: p1.y + (a * (p2.y - p1.y))
    }

    let intersection = false;
    // if line1 is a segment and line2 is infinite, they intersect if:
    if ((a > 0 && a < 1) && (b > 0 && b < 1)) {
        intersection = true;
        //console.log('line inters');
    }

    if (exact && !intersection) {
        //console.log('no line inters');
        return false;
    }


    // if line1 and line2 are segments, they intersect if both of the above are true
    return intersectionPoint;
};


/**
 * calculate polygon length
 */
function getPolygonLength(points, isPolyline = false) {
    // clone to prevent overwriting
    points = points.map(({ ...el }) => {
        return el;
    });
    let polyLength = 0;
    // repeat first point for closed polygons - not suitable for polylines
    if (!isPolyline) {
        points.push(points[0]);
    }
    for (let i = 0; i < points.length - 1; i++) {
        let p1 = points[i];
        let p2 = points[i + 1];
        let dist = getDistance(p1, p2);
        polyLength += dist;
    }
    return polyLength;
}

// getPolygonLength() wrapper for polylines
function getPolyLineLength(points) {
    let polyLength = getPolygonLength(points, true);
    return polyLength;
}



/**
 * simple performance test
 */

function perfStart() {
    t0 = performance.now();
}

function perfEnd(text = '') {
    t1 = performance.now();
    total = t1 - t0;
    console.log(`excecution time ${text}:  ${total} ms`);
    return total;
}


/**
 * adjjust viewBox
 */
function adjustViewBox(svg) {
    let bb = svg.getBBox();
    let [x, y, width, height] = [bb.x, bb.y, bb.width, bb.height];
    svg.setAttribute("viewBox", [x, y, width, height].join(" "));
}

function renderPoint(
    svg,
    coords,
    fill = "red",
    r = "2",
    opacity = "1",
    id = "",
    className = ""
) {
    //console.log(coords);
    if (Array.isArray(coords)) {
        coords = {
            x: coords[0],
            y: coords[1]
        };
    }

    let marker = `<circle class="${className}" opacity="${opacity}" id="${id}" cx="${coords.x}" cy="${coords.y}" r="${r}" fill="${fill}">
  <title>${coords.x} ${coords.y}</title></circle>`;
    svg.insertAdjacentHTML("beforeend", marker);
}


function renderPolyLine(svg, points, stroke = "green", strokeWidth = "0.5%") {
    let polyPoints = pointArrayToFlat(points);
    // render
    let polygon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline"
    );
    polygon.setAttribute("points", polyPoints.join(" "));
    polygon.setAttribute("stroke", stroke);
    polygon.setAttribute("stroke-width", strokeWidth);
    polygon.setAttribute("fill", "none");
    svg.appendChild(polygon);
}



/**
 * check if points are congruent
 */
function samePoint(p1, p2, tolerance = 0.2) {
    let isSame = false;
    let diffX = Math.abs(p1.x - p2.x);
    let diffY = Math.abs(p1.y - p2.y);
    let diff = (diffX + diffY) / 2;
    if (
        diff < tolerance
    ) {
        isSame = true;
    }
    return isSame
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
