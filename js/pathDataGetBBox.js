/**
* self contained alternative to
* calculate bounding box from pathdata string
* increase "accuracy" param to improve precision
*/

function getBBoxFromD(d, accuracy=4) {
  /**
   * convert path commands to absolute
   * shorthands to longhands
   * Arcs to cubics
   */
  // parse to pathdata array
  let pathData = parseDtoPathData(d);
  // to longhands
  pathData = pathDataToLonghands(pathData);
  // convert arcs
  pathData = convertArcsToCubics(pathData);

  // calcultate polygon points
  let polyPoints = pathDataToPolygonPoints(pathData, true, accuracy);
  let bboxPoly = getPolygonBBox(polyPoints);
  return bboxPoly;
}



//add points to enhance precision
//let dNorm = pathData.map(val=>{ return val.type+val.values.join(' ')}).join(' ')
//console.log(dNorm)

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
      return +val;
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
    pathData.push({
      type: type,
      values: chunk0
    });
    // add repeated commands
    if (chunks.length > 1) {
      for (let c = 1; c < chunks.length; c++) {
        pathData.push({
          type: repeatedType,
          values: chunks[c]
        });
      }
    }
  }
  return pathData;
}
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

function convertArcsToCubics(pathData) {
  let pathdataNew = [pathData[0]];
  for (let i = 1; i < pathData.length; i++) {
    let com = pathData[i];
    let comPrev = pathData[i - 1];
    let valuesPrev = comPrev.values;
    let valuesPrevL = valuesPrev.length;
    let [prevX, prevY] = [
      valuesPrev[valuesPrevL - 2],
      valuesPrev[valuesPrevL - 1]
    ];
    if (com.type === "A") {
      com = pathDataArcToCubic([prevX, prevY], com.values);
      //console.log(com)
    }
    pathdataNew.push(com);
  }
  return pathdataNew.flat();
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
 * convert arc commands to cubic
 * Based on: Dmitry Baranovskiy's
 * https://github.com/DmitryBaranovskiy/raphael/blob/v2.1.1/dev/raphael.core.js#L1837
 */
function pathDataArcToCubic(p0, comValues, recursive = false) {
  if (Array.isArray(p0)) {
    p0 = {
      x: p0[0],
      y: p0[1]
    };
  }
  let [r1, r2, angle, largeArcFlag, sweepFlag, x2, y2] = comValues;
  let [x1, y1] = [p0.x, p0.y];
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
  if (Math.abs(df) > (Math.PI * 120) / 180) {
    let f2old = f2;
    let x2old = x2;
    let y2old = y2;
    f2 =
      sweepFlag && f2 > f1
        ? (f2 = f1 + ((Math.PI * 120) / 180) * 1)
        : (f2 = f1 + ((Math.PI * 120) / 180) * -1);
    x2 = cx + r1 * Math.cos(f2);
    y2 = cy + r2 * Math.sin(f2);
    params = pathDataArcToCubic(
      [x2, y2],
      [r1, r2, angle, 0, sweepFlag, x2old, y2old],
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
      commands.push({
        type: "C",
        values: [r1.x, r1.y, r2.x, r2.y, r3.x, r3.y]
      });
    }
    return commands;
  }
}
// get polygon bbox
function getPolygonBBox(polyPoints) {
  let xArr = [];
  let yArr = [];
  polyPoints.forEach((point) => {
    xArr.push(point.x);
    yArr.push(point.y);
  });
  let xmin = Math.min(...xArr);
  let xmax = Math.max(...xArr);
  let ymin = Math.min(...yArr);
  let ymax = Math.max(...yArr);
  return {
    x: xmin,
    y: ymin,
    width: xmax - xmin,
    height: ymax - ymin
  };
}
/**
 * convert path d to polygon point array
 */
function pathDataToPolygonPoints(
  pathData,
  addControlPointsMid = false,
  splitNtimes = 0,
  splitLines = false
) {
  let points = [];
  pathData.forEach((com, c) => {
    let type = com.type;
    let values = com.values;
    let valL = values.length;
    // optional splitting
    let splitStep = splitNtimes
      ? 0.5 / splitNtimes
      : addControlPointsMid
      ? 0.5
      : 0;
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
      let p0 = {
        x: prevVal[prevValL - 2],
        y: prevVal[prevValL - 1]
      };
      // cubic curves
      if (type === "C") {
        if (prevValL) {
          let cp1 = {
            x: values[valL - 6],
            y: values[valL - 5]
          };
          let cp2 = {
            x: values[valL - 4],
            y: values[valL - 3]
          };
          let p = {
            x: values[valL - 2],
            y: values[valL - 1]
          };
          if (addControlPointsMid && split) {
            // split cubic curves
            for (let s = 0; split < 1 && s < 9999; s++) {
              let midPoint = getPointAtCubicSegmentLength(
                p0,
                cp1,
                cp2,
                p,
                split
              );
              points.push(midPoint);
              split += splitStep;
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
          let cp1 = {
            x: values[valL - 4],
            y: values[valL - 3]
          };
          let p = {
            x: values[valL - 2],
            y: values[valL - 1]
          };
          //let coords = prevCoords.concat(values);
          if (addControlPointsMid && split) {
            // split cubic curves
            for (let s = 0; split < 1 && s < 9999; s++) {
              let midPoint = getPointAtQuadraticSegmentLength(
                p0,
                cp1,
                p,
                split
              );
              points.push(midPoint);
              split += splitStep;
            }
          }
          points.push({
            x: values[valL - 2],
            y: values[valL - 1]
          });
        }
      }
      // linetos
      else if (type === "L") {
        if (splitLines) {
          //let prevCoords = [prevVal[prevValL - 2], prevVal[prevValL - 1]];
          let p1 = {
            x: prevVal[prevValL - 2],
            y: prevVal[prevValL - 1]
          };
          let p2 = {
            x: values[valL - 2],
            y: values[valL - 1]
          };
          if (addControlPointsMid && split) {
            for (let s = 0; split < 1; s++) {
              let midPoint = interpolatedPoint(p1, p2, split);
              points.push(midPoint);
              split += splitStep;
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
