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
    let AB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
    let BC = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(B.y - C.y, 2));
    let AC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
    return Math.acos((BC * BC + AB * AB - AC * AC) / (2 * BC * AB));
}


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
