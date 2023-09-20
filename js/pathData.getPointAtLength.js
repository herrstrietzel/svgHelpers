function getPointAtLengthLookup(pathLengthLookup, length) {
  let { segments, totalLength } = pathLengthLookup;
  let foundSegment = false;
  let pt = { x: 0, y: 0 };
  let newT = 0;

  // last point on path
  if (length.toFixed(3) == totalLength.toFixed(3)) {
    let { points } = segments[segments.length - 1];
    pt = points[points.length - 1];
    return pt;
  }

  //loop through segments
  for (let i = 0; i < segments.length && !foundSegment; i++) {
    let segment = segments[i];
    let { type, lengths, points, end, total } = segment;

    // find path segment
    if (segment.end > length) {
      foundSegment = true;
      let foundT = false;

      /**
       * lineto
       */
      if (type === "L") {
        let diffL = end - length;
        let newT = 1 - (1 / total) * diffL;
        pt = interpolatedPoint(points[0], points[1], newT);
      } else {

        /**
         * cubic or quadratic beziers
         */
        let diffRatio = 0;
        let lengthPrev = 0;
        let lengthAtT = 0;
        let diffLength = 0;

        for (let t = 0; t < lengths.length && !foundT; t++) {
          lengthAtT = lengths[t];
          /**
           * compare length between actual length and length at t
           * calculate interpolated t value to approximate t at length
           */
          let tPrev = t >= 0 ? t - 1 : 0;
          lengthPrev = lengths[tPrev];
          let lengthRange = lengthAtT - lengthPrev;
          diffLength = lengthAtT - length;

          diffRatio = lengthRange ? (1 / lengthRange) * diffLength : 1;
          let tDivisions = lengths.length - 1;
          let tInter = 1 / tDivisions;
          newT = t / tDivisions - tInter * diffRatio;

          // quit if found close length
          if (lengthAtT > length) {
            foundT = true;
          }
        }

        // calculate points
        if (type === "C") {
          pt = getPointAtCubicSegmentT(
            points[0],
            points[1],
            points[2],
            points[3],
            newT
          );
        } else if (type === "Q") {
          pt = getPointAtQuadraticSegmentT(
            points[0],
            points[1],
            points[2],
            newT
          );
        }
      }
    }
  }
  return pt;
}

/**
 * calculate pathlengths
 * per segment from pathdata array
 */
function getPathLengthLookup(d, tDivisions = 10) {

  let pathData = getPathDataNorm(d);

  // collects length metrics per segment
  let lengthObj = { totalLength: 0, segments: [] };

  let pathLength = 0;
  let M = pathData[0];
  //let off = 0;
  for (let i = 1; i < pathData.length; i++) {
    let comPrev = pathData[i - 1];
    let valuesPrev = comPrev.values;
    let valuesPrevL = valuesPrev.length;
    let [x0, y0] = [valuesPrev[valuesPrevL - 2], valuesPrev[valuesPrevL - 1]];

    let com = pathData[i];
    let type = com.type;
    let values = com.values;

    // interpret closePath as lineto
    if (type === "M") {
      M = pathData[i];
    } else if (type === "Z") {
      type = "L";
      values = M.values;
    }

    let lengthObjSegment = calcSegmentLength(
      type,
      x0,
      y0,
      values,
      pathLength,
      tDivisions
    );
    // add to length object
    lengthObj.segments.push(lengthObjSegment);

    // increase total length offset
    pathLength += lengthObjSegment.total;
  }

  lengthObj.totalLength = pathLength;
  return lengthObj;
}

/**
 * calculate segment 
 * path length from command points
 */
function calcSegmentLength(
  cmd,
  x,
  y,
  points,
  pathLength = 0,
  tDivisions = 10
) {
  let len, p0,  cp1, cp2, p, t;
  let lengthObj = {
    end: 0,
    points: [],
    total: 0,
    type: cmd,
    lengths: []
  };


  switch (cmd) {
    case "L":
      p0 = { x: x, y: y };
      p = { x: points[0], y: points[1] };
      len = getLineLength(p0, p);
      lengthObj.end = len + pathLength;
      lengthObj.total = len;
      lengthObj.lengths.push(len + pathLength);
      lengthObj.points.push(p0, p);
      break;

    case "C":
      len = 0;
      let pointL = points.length;
      p0 = { x: x, y: y };
      cp1 = { x: points[0], y: points[1] };
      cp2 = { x: points[2], y: points[3] };
      p = { x: points[pointL - 2], y: points[pointL - 1] };

      /**
       * snap length
       */
      lengthObj.lengths.push(pathLength);
      let segmentLength = bezlen(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y, 1);
      lengthObj.end0 = segmentLength + pathLength;
      //let snapL = 0;
      for (let d = 1; d <= tDivisions; d++) {
        t = (1 / tDivisions * d);
        let snapL = bezlen(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y, t);
        lengthObj.lengths.push(snapL + pathLength);
      }

      lengthObj.end = segmentLength + pathLength;
      lengthObj.total = segmentLength;
      lengthObj.points.push(p0, cp1, cp2, p);
      break;

    default:
      lengthObj.total = 0;
      break;
  }
  return lengthObj;
}



/**
 * snap.svg get cubic length
 * https://github.com/adobe-webplatform/Snap.svg/blob/master/dist/snap.svg.js#L5786
 */
function base3(t, p1, p2, p3, p4) {
  let t1 = -3 * p1 + 9 * p2 - 9 * p3 + 3 * p4,
      t2 = t * t1 + 6 * p1 - 12 * p2 + 6 * p3;
  return t * t2 - 3 * p1 + 3 * p2;
}

function bezlen(x1, y1, x2, y2, x3, y3, x4, y4, z=1) {
  z = z > 1 ? 1 : z < 0 ? 0 : z;
  let z2 = z / 2;
  let Tvalues = [-.1252,.1252,-.3678,.3678,-.5873,.5873,-.7699,.7699,-.9041,.9041,-.9816,.9816];
  let Cvalues = [0.2491,0.2491,0.2335,0.2335,0.2032,0.2032,0.1601,0.1601,0.1069,0.1069,0.0472,0.0472];
  let n = Tvalues.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
      let ct = z2 * Tvalues[i] + z2,
          xbase = base3(ct, x1, x2, x3, x4),
          ybase = base3(ct, y1, y2, y3, y4),
          comb = xbase * xbase + ybase * ybase;
      sum += Cvalues[i] * Math.sqrt(comb);
  }
  return z2 * sum;
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
  let [x, y] = [(p2.x - p1.x) * t + p1.x, (p2.y - p1.y) * t + p1.y];
  return { x: x, y: y };
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




/**
 * parse pathdata normalized
 */
function getPathDataNorm(d) {
    let hasRel = /[astvzqmhlc]/g.test(d);
    let hasShorthands = /[hstv]/gi.test(d);
    let hasArcsOrQuadratic = /[atq]/gi.test(d);
  
    let pathData = getPathData(d);
  
    if (hasRel) {
      console.log("hasRel");
      pathData = pathDataToAbsolute(pathData);
    }
  
    if (hasShorthands) {
      console.log("hasShorthands");
      pathData = pathDataToLonghands(pathData);
    }
  
    if (hasArcsOrQuadratic) {
      console.log("hasArcsOrQuadratic");
      pathData = pathDataArcsAndQuadraticToCubic(pathData);
    }
    return pathData;
  }
  
  
  
  /**
   * Based on: jkroso/parse-svg-path
   * https://github.com/jkroso/parse-svg-path
   * parse an svg path data string. Generates an Array
   * of commands where each command is an Array of the
   * form `{type:command, values:[]}`
   */
  function getPathData(path) {
    // expected argument lengths
    let length = {
      a: 7, c: 6, h: 1, l: 2, m: 2,
      q: 4, s: 4, t: 2, v: 1, z: 0
    };
    // segment pattern
    let segment = /([astvzqmhlc])([^astvzqmhlc]*)/gi;
    let number = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi;
    let data = [];
    const parseValues = (args) => {
      let numbers = args.match(number);
      return numbers ? numbers.map(Number) : [];
    };
    // split adjacent zero values like 0 05 => 0 0 5
    path = path.replace(/( )(0)(\d+)/g, "$1 $2 $3");
    path.replace(segment, function (_, command, args) {
      let type = command.toLowerCase();
      args = parseValues(args);
      // implicit lineto
      if (type == "m" && args.length > 2) {
        data.push([command].concat(args.splice(0, 2)));
        type = "l";
        command = command == "m" ? "l" : "L";
      }
      while (true) {
        if (args.length == length[type]) {
          let values = args.splice(0, length[type]);
          return data.push({ type: command, values: values });
        }
        if (args.length < length[type]) throw new Error("malformed path data");
      }
    });
    return data;
  }
  
  
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
   * reversed method: pathDataToShorthands()
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
   * convert arc commands to cubic
   * Based on: Dmitry Baranovskiy's
   * https://github.com/DmitryBaranovskiy/raphael/blob/v2.1.1/dev/raphael.core.js#L1837
   */
  function arcCommandToCubic(p0, comValues, recursive = false) {
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
      params = arcCommandToCubic(
        { x: x2, y: y2 },
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
  /**
   * normalize to all absolute, cubic, no shorthand
   */
  function pathDataArcsAndQuadraticToCubic(pathData) {
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
      if (type === "A") {
        let cubicArcs = arcCommandToCubic(p0, values);
        cubicArcs.forEach((cubicArc) => {
          pathDataNorm.push(cubicArc);
        });
      }
      // convert quadratic to cubic
      else if (type === "Q") {
        let comCubic = pathDataQuadratic2Cubic(p0, values);
        pathDataNorm.push(comCubic);
      }
      else {
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
