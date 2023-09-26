/**
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
  * based on @cuixiping;
  * https://stackoverflow.com/questions/9017100/calculate-center-of-svg-arc/12329083#12329083
  */
function svgArcToCenterParam(x1, y1, rx, ry, degree, fA, fS, x2, y2) {
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
    let phi = (degree * Math.PI) / 180;
    let cx, cy, startAngle, deltaAngle, endAngle;
    let PI = Math.PI;
    let PIx2 = PI * 2;
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
    let hd_x = (x1 - x2) / 2; // half diff of x
    let hd_y = (y1 - y2) / 2; // half diff of y
    let hs_x = (x1 + x2) / 2; // half sum of x
    let hs_y = (y1 + y2) / 2; // half sum of y
    // F6.5.1
    let x1_ = c_phi * hd_x + s_phi * hd_y;
    let y1_ = c_phi * hd_y - s_phi * hd_x;
    // F.6.6 Correction of out-of-range radii
    //   Step 3: Ensure radii are large enough
    let lambda = (x1_ * x1_) / (rx * rx) + (y1_ * y1_) / (ry * ry);
    if (lambda > 1) {
        rx = rx * Math.sqrt(lambda);
        ry = ry * Math.sqrt(lambda);
    }
    let rxry = rx * ry;
    let rxy1_ = rx * y1_;
    let ryx1_ = ry * x1_;
    let sum_of_sq = rxy1_ * rxy1_ + ryx1_ * ryx1_; // sum of square
    if (!sum_of_sq) {
        throw Error("start point can not be same as end point");
    }
    let coe = Math.sqrt(Math.abs((rxry * rxry - sum_of_sq) / sum_of_sq));
    if (fA == fS) {
        coe = -coe;
    }
    // F6.5.2
    let cx_ = (coe * rxy1_) / ry;
    let cy_ = (-coe * ryx1_) / rx;
    // F6.5.3
    cx = c_phi * cx_ - s_phi * cy_ + hs_x;
    cy = s_phi * cx_ + c_phi * cy_ + hs_y;
    let xcr1 = (x1_ - cx_) / rx;
    let xcr2 = (x1_ + cx_) / rx;
    let ycr1 = (y1_ - cy_) / ry;
    let ycr2 = (y1_ + cy_) / ry;
    // F6.5.5
    startAngle = radian(1.0, 0, xcr1, ycr1);
    // F6.5.6
    deltaAngle = radian(xcr1, ycr1, -xcr2, -ycr2);
    while (deltaAngle > PIx2) {
        deltaAngle -= PIx2;
    }
    while (deltaAngle < 0) {
        deltaAngle += PIx2;
    }
    if (fS == false || fS == 0) {
        deltaAngle -= PIx2;
    }
    endAngle = startAngle + deltaAngle;
    while (endAngle > PIx2) {
        endAngle -= PIx2;
    }
    while (endAngle < 0) {
        endAngle += PIx2;
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
        clockwise: fS == true || fS == 1
    };
    return outputObj;
}
/**
 * Ramanujan approximation
 * based on: https://www.mathsisfun.com/geometry/ellipse-perimeter.html#tool
 */
function getEllipseLength(rx, ry) {
    // is circle
    if (rx === ry) {
        //console.log('is circle')
        return 2 * Math.PI * rx;
    }
    let h = Math.pow((rx - ry) / (rx + ry), 2)
    let length = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
    return length
}


function getPointOnEllipse(rx, ry, cx, cy, deg, rotation = 0, precise = true) {
    // Convert degrees to radians
    let rad = (deg * Math.PI) / 180;
    let rotRad = (rotation * Math.PI) / 180;
    const cos = (val) => {
        let c = precise ? Math.cos(val) : 1 - (val ** 2) / 2 + (val ** 4) / 24;
        return c;
    }
    const sin = (val) => {
        let s = precise ? Math.sin(val) : val - (val ** 3) / 6 + (val ** 5) / 120;
        return s;
    }
    // Calculate the point on the ellipse without rotation
    let x = cx + rx * cos(rad);
    let y = cy + ry * sin(rad);
    // Rotate the calculated point by the specified angle
    let rotatedX = cx + (x - cx) * cos(rotRad) - (y - cy) * sin(rotRad);
    let rotatedY = cy + (x - cx) * sin(rotRad) + (y - cy) * cos(rotRad);
    return {
        x: rotatedX,
        y: rotatedY
    };
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

function adjustViewBoxPadding(svg, padding = 0) {
    let { x, y, width, height } = svg.getBBox();
    let widthNew = width + padding;
    let heightNew = height + padding;
    let xNew = +(x + width / 2 - widthNew / 2).toFixed(1);
    let yNew = +(y + height / 2 - heightNew / 2).toFixed(1);
    svg.setAttribute("viewBox", [xNew, yNew, widthNew, heightNew].join(" "));
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


function pointArrayToFlat(points) {
    let polyPoints = [];
    // if already flat array
    if (!points[0].length && !Object.hasOwn(points[0], 'x')) {
        polyPoints = points;
        console.log("is flat");
    } else {
        for (let i = 0; i < points.length; i++) {
            let point = points[i];
            if (Array.isArray(points[i])) {
                point = {
                    x: points[i][0],
                    y: points[i][1]
                };
            }
            polyPoints.push(point.x, point.y);
        }
    }
    return polyPoints;
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
