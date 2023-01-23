/**
* This helper will check path directions in compound paths and change directions to avoid even/odd fill rule issues:
* Inner (counter) shapes will get the opposite spin (clockwise or counterclockwise) according to the outer shape
* Dependencies: path-data-polyfill by Jarek Foksa: 
* https://github.com/jarek-foksa/path-data-polyfill 
* or pathData.getPathDataCustom.js:
* https://cdn.jsdelivr.net/gh/herrstrietzel/svgHelpers@latest/js/pathData.getPathDataCustom.js
*/

/**
* example usage:
*/
/*
let pathData = path.getPathData();
pathData = autoFixPathDirections(pathData);
path.setPathData(pathData);
*/


function autoFixPathDirections(pathData) {
  let pathDataArr = splitSubpaths(pathDataToLonghands(pathData));
  pathDataArr = sortSubpaths(pathDataArr);

  let directionData = [];
  pathDataArr.forEach((pathData, i) => {
    //let direction = isClockwisePathData(pathData);
    let poly = pathDataToPolygonPoints(pathData, true);
    let direction = isClockwisePolygon(poly);
    let bb = getPolygonBBox(poly);

    directionData.push({
      a: false,
      cw: direction,
      left: bb.x,
      top: bb.y,
      right: bb.x + bb.width,
      bottom: bb.y + bb.height,
      enclosedPrev: false,
      enclosedOuter: false
    });

    if (i > 0) {
      let outer = directionData[0];
      let prev = directionData[i - 1];
      let cur = directionData[i];

      // enclosed by previous
      if (
        cur.left >= prev.left &&
        cur.top >= prev.top &&
        cur.bottom <= prev.bottom &&
        cur.right <= prev.right
      ) {
        // reverse
        cur.enclosedPrev = true;
        if (prev.cw === cur.cw) {
          pathDataArr[i] = reversePathData(pathDataArr[i]);
          cur.cw = cur.cw ? false : true;
        }
      }

      // enclosed by outer
      if (
        cur.left >= outer.left &&
        cur.top >= outer.top &&
        cur.bottom <= outer.bottom &&
        cur.right <= outer.right &&
        outer.cw === cur.cw &&
        !cur.enclosedPrev
      ) {
        // reverse
        pathDataArr[i] = reversePathData(pathDataArr[i]);
        cur.cw = cur.cw ? false : true;
        cur.enclosedOuter = true;
      }
    }
  })
  return pathDataArr.flat();
}

/**
* convert path d to polygon point array
*/
function pathDataToPolygonPoints(pathData, addControlPointsMid = false, splitNtimes = 0, splitLines = false) {

  let points = [];
  // close path fix
  pathData = addClosePathLineto(pathData);
  pathData.forEach((com, c) => {
    let type = com.type;
    let values = com.values;
    let valL = values.length;

    // optional splitting
    let splitStep = splitNtimes ? (0.5 / splitNtimes) : (addControlPointsMid ? 0.5 : 0);
    let split = splitStep;

    // M 
    if (c === 0) {
      let M = {
        x: pathData[0].values[valL - 2],
        y: pathData[0].values[valL - 1]
      };
      points.push(M);
    }

    if (valL && c > 0) {
      let prev = pathData[c - 1];
      let prevVal = prev.values;
      let prevValL = prevVal.length;
      let p0 = { x: prevVal[prevValL - 2], y: prevVal[prevValL - 1] };

      // cubic curves
      if (type === "C") {
        if (prevValL) {
          let cp1 = { x: values[valL - 6], y: values[valL - 5] };
          let cp2 = { x: values[valL - 4], y: values[valL - 3] };
          let p = { x: values[valL - 2], y: values[valL - 1] };

          if (addControlPointsMid && split) {
            // split cubic curves
            for (let s = 0; split < 1 && s < 9999; s++) {
              let midPoint = getPointAtCubicSegmentLength(p0, cp1, cp2, p, split);
              points.push(midPoint);
              split += splitStep
            }
          }
          points.push({
            x: values[valL - 2],
            y: values[valL - 1]
          });
        }
      }

      // quadratic curves
      else if (type === "Q") {
        if (prevValL) {
          let cp1 = { x: values[valL - 4], y: values[valL - 3] };
          let p = { x: values[valL - 2], y: values[valL - 1] };

          //let coords = prevCoords.concat(values);
          if (addControlPointsMid && split) {
            // split cubic curves
            for (let s = 0; split < 1 && s < 9999; s++) {
              let midPoint = getPointAtQuadraticSegmentLength(p0, cp1, p, split);
              points.push(midPoint);
              split += splitStep
            }
          }
          points.push({
            x: values[valL - 2],
            y: values[valL - 1]
          });
        }
      }

      // arc
      else if (type === 'A') {
        if (addControlPointsMid) {
          // convert arcs to cubic
          let pathDataArcs = pathDataArcToCubic(p0, values, recursive = false);

          for (let a = 0; a < pathDataArcs.length; a++) {
            let values = pathDataArcs[a].values;
            let valL = values.length;
            let prev = a === 0 ? pathData[c - 1] : pathDataArcs[a - 1];
            let prevVal = prev.values;
            let prevValL = prevVal.length;
            let p0 = { x: prevVal[prevValL - 2], y: prevVal[prevValL - 1] };
            let cp1 = { x: values[valL - 6], y: values[valL - 5] };
            let cp2 = { x: values[valL - 4], y: values[valL - 3] };
            let p = { x: values[valL - 2], y: values[valL - 1] };

            if (addControlPointsMid) {
              // split cubic curves
              split = 0.25;
              for (let s = 0; s < 1 && s < 9999; s += split) {
                let midPoint = getPointAtCubicSegmentLength(p0, cp1, cp2, p, s);
                points.push(midPoint);
              }
            }
            else {
              points.push(p);
            }
          }
        }
      }

      // linetos
      else if (type === "L") {
        if (splitLines) {
          //let prevCoords = [prevVal[prevValL - 2], prevVal[prevValL - 1]];
          let p1 = { x: prevVal[prevValL - 2], y: prevVal[prevValL - 1] }
          let p2 = { x: values[valL - 2], y: values[valL - 1] }

          if (addControlPointsMid && split) {
            for (let s = 0; split < 1; s++) {
              let midPoint = interpolatedPoint(p1, p2, split);
              points.push(midPoint);
              split += splitStep
            }
          }
        }
        points.push({
          x: values[valL - 2],
          y: values[valL - 1]
        });
      }
    }
  });
  return points;
}

function polygonArea(points, absolute = false) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const addX = points[i].x;
    const addY = points[i === points.length - 1 ? 0 : i + 1].y;
    const subX = points[i === points.length - 1 ? 0 : i + 1].x;
    const subY = points[i].y;
    area += addX * addY * 0.5 - subX * subY * 0.5;
  }
  if (absolute) {
    area = Math.abs(area);
  }
  return area;
}

function isClockwisePathData(pathData) {
  let polyPoints = pathDataToPolygonPoints(pathData);
  let area = polygonArea(polyPoints);
  let clockwise = area > 0;
  return clockwise;
}

function isClockwisePolygon(polyPoints) {
  let area = polygonArea(polyPoints);
  let clockwise = area > 0;
  return clockwise;
}

function getPolygonBBox(polyPoints) {
  let xArr = [];
  let yArr = [];
  polyPoints.forEach(point => {
    xArr.push(point.x);
    yArr.push(point.y);
  })
  let xmin = Math.min(...xArr);
  let xmax = Math.max(...xArr);
  let ymin = Math.min(...yArr);
  let ymax = Math.max(...yArr);
  return { x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin }
}


/**
 * reverse pathdata
 */
function reversePathData(pathData, decimals = -1) {
  /**
   * make sure all command coordinates are absolute and
   * shorthands are converted to long notation
   */
  pathData = pathDataToLonghands(pathDataToAbsolute(pathData, decimals));

  // split to sub path array
  let pathDataArray = splitSubpaths(pathData);

  // start compiling new path data
  let pathDataNew = [];

  // helper to rearrange control points for all command types
  const reverseControlPoints = (type, values) => {
    let controlPoints = [];
    let endPoint = [];
    if (type !== "A") {
      for (let p = 0; p < values.length; p += 2) {
        controlPoints.push([values[p], values[p + 1]]);
      }
      endPoint = controlPoints.pop();
      controlPoints.reverse();
    }
    // is arc
    else {
      //reverse sweep;
      let sweep = values[4] == 0 ? 1 : 0;
      controlPoints = [values[0], values[1], values[2], values[3], sweep];
      endPoint = [values[5], values[6]];
    }
    return [controlPoints, endPoint];
  };

  pathDataArray.forEach((pathData) => {
    let closed =
      pathData[pathData.length - 1].type.toLowerCase() === "z" ? true : false;
    if (closed) {
      // add lineto closing space between Z and M
      pathData = addClosePathLineto(pathData);
      // remove Z closepath
      pathData.pop();
    }

    // define last point as new M if path isn't closed
    let valuesLast = pathData[pathData.length - 1].values;
    let valuesLastL = valuesLast.length;
    let M = closed
      ? pathData[0]
      : {
        type: "M",
        values: [valuesLast[valuesLastL - 2], valuesLast[valuesLastL - 1]]
      };
    // starting M stays the same – unless the path is not closed
    pathDataNew.push(M);

    // reverse path data command order for processing
    pathData.reverse();
    for (let i = 1; i < pathData.length; i++) {
      let com = pathData[i];
      let type = com.type;
      let values = com.values;
      let valuesL = values.length;
      let comPrev = pathData[i - 1];
      let typePrev = comPrev.type;
      let valuesPrev = comPrev.values;
      // get reversed control points and new end coordinates
      let [controlPointsPrev, endPointsPrev] = reverseControlPoints(
        typePrev,
        valuesPrev
      );
      let [controlPoints, endPoints] = reverseControlPoints(type, values);

      // create new path data
      let newValues = [];
      newValues = controlPointsPrev.flat().concat(endPoints);
      pathDataNew.push({
        type: typePrev,
        values: newValues
      });
    }

    // add previously removed Z close path
    if (closed) {
      pathDataNew.push({
        type: "z",
        values: []
      });
    }
  });
  return pathDataNew;
}

function sortSubpaths(pathDataArr, sortBy = ["x", "y"]) {
  let subPathArr = [];
  pathDataArr.forEach(function (pathData, i) {
    let polyPoints = pathDataToPolygonPoints(pathData, true);
    let bb = getPolygonBBox(polyPoints);
    let [x, y, width, height] = [bb.x, bb.y, bb.width, bb.height];
    subPathArr.push({
      x: x,
      y: y,
      width: width,
      height: height,
      index: i
    });
  });

  //sort by size
  subPathArr.sort(fieldSorter(sortBy));
  let subPathsSorted = [];
  subPathArr.forEach(function (sub, i) {
    let index = sub.index;
    subPathsSorted.push(pathDataArr[index]);
  });
  return subPathsSorted;
}

function fieldSorter(fields) {
  return function (a, b) {
    return fields
      .map(function (o) {
        var dir = 1;
        if (o[0] === "-") {
          dir = -1;
          o = o.substring(1);
        }
        if (a[o] > b[o]) return dir;
        if (a[o] < b[o]) return -dir;
        return 0;
      })
      .reduce(function firstNonZeroValue(p, n) {
        return p ? p : n;
      }, 0);
  };
}




/**
 * shift starting point
 */
function shiftSvgStartingPoint(pathData, offset) {
  let pathDataL = pathData.length;
  let newStartIndex = 0;
  if (offset == 0) {
    return pathData;
  }

  //exclude Z/z (closepath) command if present
  let lastCommand = pathData[pathDataL - 1]["type"];
  let trimRight = lastCommand.toLowerCase() == "z" ? 1 : 0;

  // M start offset
  newStartIndex =
    offset + 1 < pathData.length - 1
      ? offset + 1
      : pathData.length - 1 - trimRight;

  // slice array to reorder
  let pathDataStart = pathData.slice(newStartIndex);
  let pathDataEnd = pathData.slice(0, newStartIndex);

  // remove original M
  pathDataEnd.shift();
  let pathDataEndL = pathDataEnd.length;

  let pathDataEndLastValues = pathDataEnd[pathDataEndL - 1]["values"];
  let pathDataEndLastXY = [
    pathDataEndLastValues[pathDataEndLastValues.length - 2],
    pathDataEndLastValues[pathDataEndLastValues.length - 1]
  ];

  //remove z(close path) from original pathdata array
  if (trimRight) {
    pathDataStart.pop();
    pathDataEnd.push({
      type: "Z",
      values: []
    });
  }
  // prepend new M command and concatenate array chunks
  pathData = [
    {
      type: "M",
      values: pathDataEndLastXY
    }
  ]
    .concat(pathDataStart)
    .concat(pathDataEnd);

  return pathData;
}

/**
 * split compound paths into sub path data array
 */
function splitSubpaths(pathData) {
  let subPathArr = [];
  let subPathMindex = [];
  pathData.forEach((com, i) => {
    let type = com.type;
    if (type == "M") {
      subPathMindex.push(i);
    }
  });
  //split segments after M command
  subPathMindex.forEach((index, i) => {
    let n = subPathMindex[i + 1];
    let thisSeg = pathData.slice(index, n);
    subPathArr.push(thisSeg);
  });
  return subPathArr;
}

/**
 * Add closing lineto:
 * needed for path reversing or adding points
 */

function addClosePathLineto(pathData) {
  let pathDataL = pathData.length;
  let closed = pathData[pathDataL - 1]["type"] == "Z" ? true : false;

  let M = pathData[0];
  let [x0, y0] = [M.values[0], M.values[1]];
  let lastCom = closed ? pathData[pathDataL - 2] : pathData[pathDataL - 1];
  let lastComL = lastCom.values.length;
  let [xE, yE] = [lastCom.values[lastComL - 2], lastCom.values[lastComL - 1]];
  if (closed && (x0 != xE || y0 != yE)) {
    //console.log('add final lineto')
    pathData.pop();
    pathData.push(
      {
        type: "L",
        values: [x0, y0]
      },
      {
        type: "Z",
        values: []
      }
    );
  }
  return pathData;
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

function getPointAtCubicSegmentLength(p0, cp1, cp2, p, t) {
  let t1 = 1 - t;
  return {
    x: t1 ** 3 * p0.x + 3 * t1 ** 2 * t * cp1.x + 3 * t1 * t ** 2 * cp2.x + t ** 3 * p.x,
    y: t1 ** 3 * p0.y + 3 * t1 ** 2 * t * cp1.y + 3 * t1 * t ** 2 * cp2.y + t ** 3 * p.y
  }
}

function getPointAtQuadraticSegmentLength(p0, cp1, p, t = 0.5) {
  let t1 = 1 - t;
  return {
    x: t1 * t1 * p0.x + 2 * t1 * t * cp1.x + t ** 2 * p.x,
    y: t1 * t1 * p0.y + 2 * t1 * t * cp1.y + t ** 2 * p.y
  }
}


function analyzePathData(pathData) {

    let minDec = 0;
    let hasShorthand = false;
    let hasRelative = false;
    let subPathCount = 0;
    pathData.forEach((com, i) => {
      let type = com.type;
      let typeA = type.toUpperCase();
      if (type != typeA) {
        hasRelative = true;
      }
  
      // test shorthands
      const regex = new RegExp("[H|V|S|T]", "gi");
      if (regex.test(typeA)) {
        hasShorthand = true;
      }
  
      //test subpaths
      if (type.toLowerCase() === 'm' && i > 0) {
        subPathCount++
      }
  
      let values = com.values;
      values.forEach((val) => {
        let numArr = (+val.toFixed(8)).toString().split(".").filter(Boolean);
        if (numArr[1]) {
          let decs = numArr[1].length;
          if (decs > minDec) {
            minDec = decs;
          }
        }
      });
    });
  
    let comLast = pathData[pathData.length - 1].type.toLowerCase();
    let isClosed = comLast === 'z' ? true : false;
  
    return {
      minDec: minDec,
      hasShorthand: hasShorthand,
      hasRelative: hasRelative,
      closed: isClosed,
      subPathCount: subPathCount
    };
  }
