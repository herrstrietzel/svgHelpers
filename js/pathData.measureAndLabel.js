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


    function getPAthDataLength(pathData) {
      // get pathdata
      let pathLength = 0;
      let M = pathData[0];

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
            break;

          case "L":
            len = getLineLength(p0, p);
            break;

          case "C":
          case "Q":
            cp1 = { x: values[0], y: values[1] };
            cp2 = type === 'C' ? { x: values[2], y: values[3] } : cp1;
            len = type === 'C' ? cubicBezierLength(p0, cp1, cp2, p, 1) : quadraticBezierLength(p0, cp1, p, 1);
            break;
          default:
            len = 0;
            break;
        }
        pathLength += len;
      }
      return pathLength;
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
      };
      t = t > 1 ? 1 : t < 0 ? 0 : t;
      let t2 = t / 2;
      let Tvalues = [
        -0.0640568928626056260850430826247450385909,
        0.0640568928626056260850430826247450385909,
        -0.1911188674736163091586398207570696318404,
        0.1911188674736163091586398207570696318404,
        -0.3150426796961633743867932913198102407864,
        0.3150426796961633743867932913198102407864,
        -0.4337935076260451384870842319133497124524,
        0.4337935076260451384870842319133497124524,
        -0.5454214713888395356583756172183723700107,
        0.5454214713888395356583756172183723700107,
        -0.6480936519369755692524957869107476266696,
        0.6480936519369755692524957869107476266696,
        -0.7401241915785543642438281030999784255232,
        0.7401241915785543642438281030999784255232,
        -0.8200019859739029219539498726697452080761,
        0.8200019859739029219539498726697452080761,
        -0.8864155270044010342131543419821967550873,
        0.8864155270044010342131543419821967550873,
        -0.9382745520027327585236490017087214496548,
        0.9382745520027327585236490017087214496548,
        -0.9747285559713094981983919930081690617411,
        0.9747285559713094981983919930081690617411,
        -0.9951872199970213601799974097007368118745,
        0.9951872199970213601799974097007368118745
      ];
      let Cvalues = [
        0.1279381953467521569740561652246953718517,
        0.1279381953467521569740561652246953718517,
        0.1258374563468282961213753825111836887264,
        0.1258374563468282961213753825111836887264,
        0.1216704729278033912044631534762624256070,
        0.1216704729278033912044631534762624256070,
        0.1155056680537256013533444839067835598622,
        0.1155056680537256013533444839067835598622,
        0.1074442701159656347825773424466062227946,
        0.1074442701159656347825773424466062227946,
        0.0976186521041138882698806644642471544279,
        0.0976186521041138882698806644642471544279,
        0.0861901615319532759171852029837426671850,
        0.0861901615319532759171852029837426671850,
        0.0733464814110803057340336152531165181193,
        0.0733464814110803057340336152531165181193,
        0.0592985849154367807463677585001085845412,
        0.0592985849154367807463677585001085845412,
        0.0442774388174198061686027482113382288593,
        0.0442774388174198061686027482113382288593,
        0.0285313886289336631813078159518782864491,
        0.0285313886289336631813078159518782864491,
        0.0123412297999871995468056670700372915759,
        0.0123412297999871995468056670700372915759
      ];


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
 * James Godfrey-Kittle/@jamesgk : https://github.com/Pomax/BezierInfo-2/issues/238
 */
function getBezierArea(coords) {
  let x0 = coords[0];
  let y0 = coords[1];
  //if is cubic command
  if (coords.length == 8) {
    let x1 = coords[2];
    let y1 = coords[3];
    let x2 = coords[4];
    let y2 = coords[5];
    let x3 = coords[6];
    let y3 = coords[7];
    let area =
      ((x0 * (-2 * y1 - y2 + 3 * y3) +
        x1 * (2 * y0 - y2 - y3) +
        x2 * (y0 + y1 - 2 * y3) +
        x3 * (-3 * y0 + y1 + 2 * y2)) *
        3) /
      20;
    return area;
  } else {
    return 0;
  }
}

function polygonArea(points, absolute = true) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const addX = points[i][0];
    const addY = points[i === points.length - 1 ? 0 : i + 1][1];
    const subX = points[i === points.length - 1 ? 0 : i + 1][0];
    const subY = points[i][1];
    area += addX * addY * 0.5 - subX * subY * 0.5;
  }
  if (absolute) {
    area = Math.abs(area);
  }
  return area;
}

function getPolygonArea(el) {
  // convert point string to arra of numbers
  let points = el
    .getAttribute("points")
    .split(/,| /)
    .filter(Boolean)
    .map((val) => {
      return parseFloat(val);
    });
  let polyPoints = [];
  for (let i = 0; i < points.length; i += 2) {
    polyPoints.push([points[i], points[i + 1]]);
  }
  let area = polygonArea(polyPoints);
  return area;
}



